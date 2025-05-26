/*************************************************
 * routes/feed.js
 *************************************************/
const express  = require('express');
const Photo    = require('../models/Photo');
const Event    = require('../models/Event');
const User     = require('../models/User');
const protect  = require('../middleware/auth');

const router = express.Router();

/* ─── scoring helper ─── */
const recencyScore = (d) => {
  const hours = (Date.now() - d.getTime()) / 3.6e6;
  return Math.exp(-hours / 18);
};

/* ─── main GET /feed ─── */
router.get('/feed', protect, async (req, res) => {
  const page  = +req.query.page  || 1;
  const limit = +req.query.limit || 10;
  const skip  = (page - 1) * limit;
  console.log(`🟡 [API] /feed -> user ${req.user._id} page ${page}`);

  try {
    /* 1) viewer info ---------------------------------------------------- */
    const viewer = await User.findById(req.user._id)
      .select('following interests')
      .populate('following','_id');

    const followingIds = viewer.following.map((u)=>u._id);
    const interests    = viewer.interests || [];
    console.log(`🟡   following ${followingIds.length}   interests ${interests.length}`);

    /* 2) fetch raw posts + events -------------------------------------- */
    const [postsRaw, eventsRaw] = await Promise.all([
      Photo.find({
        $or:[
          { user:{ $in:followingIds } },
          { tags:{ $in:interests    } },
        ],
      }).select('+likes +comments').lean(),

      Event.find({
        isPublic:true,
        $or:[
          { host:{ $in:followingIds } },
          { categories:{ $in:interests } },
        ],
      }).select('+attendees').lean(),
    ]);

    console.log('🟡   postsRaw',postsRaw.length,'eventsRaw',eventsRaw.length);

    /* 3) score ---------------------------------------------------------------- */
    const w = { rec:3, eng:2, rel:1.5, int:1 };
    const scored = [];

    postsRaw.forEach((p)=>{
      const s =
        w.rec*recencyScore(p.uploadDate) +
        w.eng*Math.log10((p.likes?.length||0)+(p.comments?.length||0)+1) +
        w.rel*(followingIds.some(id=>id.equals(p.user))?1:0) +
        w.int*(p.tags?.some(t=>interests.includes(t))?1:0);
      scored.push({ kind:'post', doc:p, score:s });
    });

    eventsRaw.forEach((e)=>{
      const s =
        w.rec*recencyScore(e.time) +
        w.eng*Math.log10((e.attendees?.length||0)+1) +
        w.rel*(followingIds.some(id=>id.equals(e.host))?1:0) +
        w.int*(e.categories?.some(c=>interests.includes(c))?1:0);
      scored.push({ kind:'event', doc:e, score:s });
    });

    /* 4) sort / slice --------------------------------------------------- */
    scored.sort((a,b)=>b.score-a.score);
    const pageSlice = scored.slice(skip, skip+limit);
    console.log('🟡   pageSlice', pageSlice.length);

    /* 5) lightweight populate ------------------------------------------ */
    const feed = await Promise.all(pageSlice.map(async item=>{
      if(item.kind==='post'){
        return Photo.populate(item.doc,[
          { path:'user',  select:'username profilePicture' },
          { path:'event', select:'title time' }
        ]);
      }
      return Event.populate(item.doc,{ path:'host',select:'username profilePicture' });
    }));

    console.log('🟢  sending feed len', feed.length);
    return res.json({
      feed,
      page,
      totalPages: Math.ceil(scored.length/limit),
    });
  } catch (err) {
    console.error('❌  /feed error', err);
    return res.status(500).json({ message:'Server error' });
  }
});

module.exports = router;