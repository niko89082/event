const express = require('express');
const multer = require('multer');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Photo = require('../models/Photo');
const User = require('../models/User');
const protect = require('../middleware/auth');
const paypal = require('paypal-rest-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
console.log(process.env.STRIPE_SECRET_KEY)
const router = express.Router();

const UP_DIR      = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR   = path.join(UP_DIR, 'photos');
const COVER_DIR   = path.join(UP_DIR, 'event-covers');
[PHOTO_DIR, COVER_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'coverImage' ? COVER_DIR : PHOTO_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

/* helper to coerce booleans coming from multipart/form-data */
const bool = (v) => v === true || v === 'true';

// PayPal Configuration
paypal.configure({
  'mode': 'sandbox', // Sandbox or live
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET,
});


router.post('/create', protect, upload.single('coverImage'), async (req,res)=>{
  try{
    const {
      title, description, category = 'General',
      time, location,
      maxAttendees = 10, price = 0,
      isPublic, allowPhotos, openToPublic,
      allowUploads, allowUploadsBeforeStart,
      groupId, geo    // geo is a stringified JSON from FE (optional)
    } = req.body;

    /* optional group link */
    let group = null;
    if (groupId){
      group = await Group.findById(groupId);
      if (!group)            return res.status(404).json({ message:'Group not found' });
      const isMember = group.members.some(m=>String(m)===String(req.user._id));
      if (!isMember)         return res.status(403).json({ message:'Not a member of the group' });
    }

    /* assemble doc */
    const event = new Event({
      title, description, category,
      time, location,
      maxAttendees : parseIntSafe(maxAttendees),
      price        : parseFloatSafe(price),
      host         : req.user._id,
      isPublic     : parseBool(isPublic),
      allowPhotos  : parseBool(allowPhotos),
      openToPublic : parseBool(openToPublic),
      allowUploads : parseBool(allowUploads),
      allowUploadsBeforeStart : parseBool(allowUploadsBeforeStart),
      group        : group?._id
    });

    /* geo JSON (optional) */
    if (geo){
      const g = JSON.parse(geo);
      if (Array.isArray(g.coordinates) && g.coordinates.length === 2){
        event.geo = g;           // { type:'Point', coordinates:[lng,lat] }
      }
    }

    if (req.file){
      event.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    await event.save();
    if (group){ group.events.push(event._id); await group.save(); }

    res.status(201).json(event);

  }catch(err){
    console.error('Create event →', err);
    res.status(500).json({ message:'Server error', error:err.message });
  }
});


function getNextRecurringDate(currentDate, recurring) {
  const nextDate = new Date(currentDate);
  switch (recurring) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  return nextDate;
}

// Get all events
router.get('/', protect, async (req,res)=>{
  /* public + private-visible */
  try{
    const uid = String(req.user._id);
    const events = await Event.find({
      $or:[
        { isPublic:true },
        { host:uid },
        { coHosts:uid },
        { attendees:uid },
        { invitedUsers:uid }
      ]
    }).sort({ time:1 });
    res.json(events);
  }catch(e){ res.status(500).json({ message:'Server error' }); }
});

router.get('/my-photo-events', protect, async (req, res) => {
  try {
    const list = await Event.find({
      allowPhotos:true,
      $or:[ { attendees:req.user._id }, { checkedIn:req.user._id } ]
    }).select('title time allowPhotos');
    res.json(list);
  } catch (err) {
    console.error('/my-photo-events =>', err);
    res.status(500).json({ message:'Server error' });
  }
});


// Get Event by ID// routes/events.js
router.get('/:eventId', protect, async (req,res)=>{
  try{
    const evt = await Event.findById(req.params.eventId)
      .populate('host',    'username profilePicture')
      .populate('coHosts', 'username')
      .populate('attendees invitedUsers', 'username')
      .populate({
        path:'photos',
        populate:{ path:'user', select:'username isPrivate followers' }
      });

    if (!evt) return res.status(404).json({ message:'Event not found' });

    /* privacy gate for private events */
    if (!evt.isPublic && ![
      String(evt.host._id),
      ...evt.coHosts.map(String),
      ...evt.attendees.map(String),
      ...evt.invitedUsers.map(String)
    ].includes(String(req.user._id))){
      return res.status(403).json({ message:'Private event' });
    }

    res.json(evt);

  }catch(e){ res.status(500).json({ message:'Server error' }); }
});


// Update Event
router.put('/:eventId', protect, upload.single('coverImage'), async (req,res)=>{
  try{
    const evt = await Event.findById(req.params.eventId);
    if(!evt) return res.status(404).json({ message:'Event not found' });

    const isHostLike = String(evt.host) === String(req.user._id) ||
                       evt.coHosts.includes(req.user._id);
    if (!isHostLike) return res.status(403).json({ message:'Not authorized' });

    const fields = [
      'title','description','category','time','location','maxAttendees',
      'price','isPublic','allowPhotos','openToPublic',
      'allowUploads','allowUploadsBeforeStart'
    ];
    fields.forEach(f=>{
      if (req.body[f] !== undefined) evt[f] =
        (f==='price'||f==='maxAttendees') ? parseFloatSafe(req.body[f]) :
        (typeof evt[f] === 'boolean')     ? parseBool(req.body[f])       :
        req.body[f];
    });

    /* geo update (optional) */
    if (req.body.geo){
      const g = JSON.parse(req.body.geo);
      if (Array.isArray(g.coordinates) && g.coordinates.length===2){
        evt.geo = g;
      }
    }

    if (req.file){
      /* delete old cover if any */
      if (evt.coverImage){
        fs.unlink(path.join(__dirname,'..',evt.coverImage), ()=>{});
      }
      evt.coverImage = `/uploads/event-covers/${req.file.filename}`;
    }

    await evt.save();
    res.json(evt);

  }catch(e){
    console.error('Update event →', e);
    res.status(500).json({ message:'Server error', error:e.message });
  }
});


// Delete Event
router.delete('/attend/:eventId', protect, async (req,res)=>{
  try{
    const evt = await Event.findById(req.params.eventId);
    if(!evt) return res.status(404).json({ message:'Event not found' });

    if (!evt.attendees.includes(req.user._id)){
      return res.status(400).json({ message:'You are not attending' });
    }
    evt.attendees.pull(req.user._id);
    await evt.save();
    res.json({ message:'Left event', evt });
  }catch(e){ res.status(500).json({ message:'Server error' }); }
});

// Attend Event
router.post('/attend/:eventId', protect, async (req,res)=>{
  try{
    const evt = await Event.findById(req.params.eventId);
    if(!evt) return res.status(404).json({ message:'Event not found' });

    if (Date.now() > new Date(evt.time)) {
      return res.status(400).json({ message:'Event already started' });
    }

    if (evt.attendees.includes(req.user._id)){
      return res.status(400).json({ message:'Already attending' });
    }

    /* handle ticket price via Stripe */
    if (evt.price > 0 && !req.body.paymentConfirmed){
      const pi = await stripe.paymentIntents.create({
        amount   : Math.round(evt.price*100),
        currency : 'usd',
        metadata : { eventId:evt._id.toString(), userId:req.user._id.toString() }
      });
      return res.json({ clientSecret:pi.client_secret });
    }

    evt.attendees.push(req.user._id);
    await evt.save();
    res.json({ message:'You are now attending', evt });

  }catch(e){ res.status(500).json({ message:'Server error', error:e.message }); }
});
// Add Co-host
router.post('/:eventId/cohost', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body; // user we want to add as cohost

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Must be host to add co-hosts
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can add co-hosts' });
    }

    // Check if user is already in coHosts
    if (event.coHosts.includes(userId)) {
      return res.status(400).json({ message: 'User is already a co-host' });
    }

    event.coHosts.push(userId);
    await event.save();

    return res.json({ message: 'Co-host added successfully', event });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Upload documents for an event
router.post('/upload/:eventId', protect, upload.array('documents'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user.id && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    req.files.forEach(file => {
      event.documents.push(`/uploads/documents/${file.filename}`);
    });

    await event.save();
    res.status(200).json({ message: 'Documents uploaded successfully', documents: event.documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send announcements to event attendees
router.post('/announce/:eventId', protect, async (req, res) => {
  const { message } = req.body;

  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.host.toString() !== req.user.id && !event.coHosts.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    event.announcements.push({ message });

    await event.save();
    res.status(200).json({ message: 'Announcement sent', announcements: event.announcements });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like Event
router.post('/like/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.likes.includes(req.user._id)) {
      // Unlike the event
      event.likes.pull(req.user._id);
    } else {
      // Like the event
      event.likes.push(req.user._id);
    }

    await event.save();
    res.status(200).json(event.likes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Comment on Event
router.post('/comment/:eventId', protect, async (req, res) => {
  const { text, tags } = req.body;

  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const comment = {
      user: req.user._id,
      text,
      tags,
    };

    event.comments.push(comment);
    await event.save();
    res.status(200).json(event.comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending events
router.get('/trending', async (req, res) => {
  try {
    const events = await Event.find().sort({ attendees: -1 }).limit(10).populate('host', 'username');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase ticket using PayPal
router.post('/purchase/:eventId', protect, async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ message: 'Event is full' });
    }

    const payment = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal',
      },
      redirect_urls: {
        return_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
      },
      transactions: [{
        item_list: {
          items: [{
            name: event.title,
            sku: '001',
            price: event.ticketPrice.toString(),
            currency: 'USD',
            quantity: 1,
          }],
        },
        amount: {
          currency: 'USD',
          total: event.ticketPrice.toString(),
        },
        description: `Ticket for ${event.title}`,
      }],
    };

    paypal.payment.create(payment, (error, payment) => {
      if (error) {
        return res.status(500).json({ message: 'PayPal payment error', error });
      }

      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === 'approval_url') {
          return res.status(200).json({ forwardLink: payment.links[i].href });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get events for a calendar view
router.get('/calendar', protect, async (req, res) => {
  try {
    const events = await Event.find().populate('host', 'username');
    const calendarEvents = events.map(event => ({
      title: event.title,
      start: event.time,
      end: event.time, // Assuming the event is a one-day event. Adjust if needed.
      url: `/events/${event._id}`,
    }));
    res.status(200).json(calendarEvents);
  } catch (error) {
    res.status500.json({ message: 'Server error' });
  }
});

// Delete Photo from Event
router.delete('/:eventId/photo/:photoId', protect, async (req,res)=>{
  try{
    const { eventId, photoId } = req.params;
    const justUnlink = req.query.removeTagOnly === 'true';

    const evt = await Event.findById(eventId);
    if(!evt) return res.status(404).json({ message:'Event not found' });

    const isHostLike = String(evt.host) === String(req.user._id) ||
                       evt.coHosts.includes(req.user._id);
    if(!isHostLike) return res.status(403).json({ message:'Not authorized' });

    if (!evt.photos.includes(photoId)){
      return res.status(400).json({ message:'Photo not in event' });
    }

    evt.photos.pull(photoId);
    if (!evt.removedPhotos.includes(photoId)) evt.removedPhotos.push(photoId);
    await evt.save();

    if (justUnlink){
      await Photo.findByIdAndUpdate(photoId,{ visibleInEvent:false });
      return res.json({ message:'Photo un-linked from event' });
    }

    /* full delete */
    const ph = await Photo.findById(photoId);
    if(ph){
      ph.paths.forEach(p=>fs.unlink(path.join(__dirname,'..',p),()=>{}));
      await ph.remove();
    }
    res.json({ message:'Photo deleted' });

  }catch(e){ res.status(500).json({ message:'Server error', error:e.message }); }
});

// Share Event
router.get('/share/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Increment share count
    event.shareCount += 1;
    await event.save();

    const shareLink = `${req.protocol}://${req.get('host')}/events/${event._id}`;
    const socialLinks = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareLink}`,
      twitter: `https://twitter.com/intent/tweet?text=Check%20this%20out!%20${shareLink}`,
      whatsapp: `https://api.whatsapp.com/send?text=Check%20this%20out!%20${shareLink}`,
      email: `mailto:?subject=Check%20this%20out!&body=Here%20is%20something%20interesting:%20${shareLink}`
    };

    res.status(200).json({ shareLink, socialLinks });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Check-in endpoint
// routes/events.js

router.post('/:eventId/checkin', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { scannedUserId } = req.body; // user ID from the QR code

    const event = await Event.findById(eventId)
      .populate('attendees', '_id username profilePicture')
      .populate('checkedIn', '_id username profilePicture');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Ensure the requestor is the host or co-host
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts.some(
      (c) => String(c) === String(req.user._id)
    );
    if (!isHost && !isCoHost) {
      return res.status(401).json({
        message: 'User not authorized to check in attendees',
      });
    }

    // Find the user doc
    const user = await User.findById(scannedUserId).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'Scanned user not found in system' });
    }

    // Check if user is in event.attendees
    const isAttendee = event.attendees.some((a) => a._id.equals(scannedUserId));
    if (!isAttendee) {
      // They are NOT in the official attendee list => front end can handle
      return res.json({
        status: 'not_attendee',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    // If user is an attendee => see if they are already checked in
    const isAlreadyCheckedIn = event.checkedIn.some((id) =>
      String(id) === String(scannedUserId)
    );
    if (isAlreadyCheckedIn) {
      return res.json({
        status: 'already_checked_in',
        user: {
          _id: user._id,
          username: user.username,
          profilePicture: user.profilePicture || null,
        },
      });
    }

    // Otherwise, add them to checkedIn
    event.checkedIn.push(scannedUserId);
    await event.save();

    return res.json({
      status: 'success',
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// In your events router:
// routes/events.js (excerpt)
router.get('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('host', 'username')
      .populate('coHosts', 'username')
      .populate('attendees', 'username')
      .populate('invitedUsers', 'username')
      .populate('comments.user', 'username')
      .populate('comments.tags', 'username')
      .populate('announcements')
      .populate('documents')
      .populate('likes', 'username')
      .populate({
        path: 'photos',
        populate: { path: 'user', select: 'username' }
      });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    // (Additional authorization logic, if needed)
    res.status(200).json(event);
  } catch (error) {
    console.error('GET /:eventId error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/invite', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body; // The user we want to invite

    const event = await Event.findById(eventId)
      .populate('coHosts', '_id')
      .populate('host', '_id');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Must be host or co-host
    const currentUserId = String(req.user._id);
    const isHost = String(event.host._id) === currentUserId;
    const isCoHost = event.coHosts.some(
      (c) => String(c._id) === currentUserId
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({
        message: 'Only the host or a co-host can invite people to this event',
      });
    }

    // Check if user is already invited
    if (event.invitedUsers.includes(userId)) {
      return res
        .status(400)
        .json({ message: 'User is already invited to this event' });
    }

    // Invite the user
    event.invitedUsers.push(userId);
    await event.save();

    // (Optional) Auto-send a message with shareType='event'
    // If you want to do it, you'd need to find or create a conversation:
    // let conversation = await Conversation.findOne({ /* find user & host participants... */ });
    // if (!conversation) { ... create conversation ... }
    // Then create a message:
    //
    // const msg = new Message({
    //   sender: req.user._id,
    //   recipient: userId,
    //   conversation: conversation._id,
    //   content: `You've been invited to ${event.title}`,
    //   shareType: 'event',
    //   shareId: event._id,
    // });
    // await msg.save();
    //
    // conversation.messages.push(msg._id);
    // conversation.lastMessage = msg._id;
    // conversation.lastMessageAt = new Date();
    // await conversation.save();

    return res.json({
      message: 'User invited successfully.',
      event,
      // messageId: msg._id, // if you implemented the messaging
    });
  } catch (error) {
    console.error('POST /:eventId/invite error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/user/:userId/calendar', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;  // optional

    if (userId.toString() !== req.user._id.toString()) {
      // or check if admin, or if user is viewing own data
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Find the user
    const user = await User.findById(userId).populate('attendingEvents');
    if (!user) return res.status(404).json({ message: 'User not found' });

    let events = user.attendingEvents;  
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1); 
      events = events.filter((evt) => {
        if (!evt.time) return false;
        const t = new Date(evt.time);
        return (t >= startDate && t < endDate);
      });
    }

    res.json({ events });
  } catch (error) {
    console.error('GET /events/user/:userId/calendar error =>', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// routes/events.js
router.delete('/attend/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const isAttendee = event.attendees.includes(req.user._id);
    if (!isAttendee) {
      return res.status(400).json({ message: 'You are not attending this event' });
    }

    // remove user from event.attendees
    event.attendees.pull(req.user._id);
    await event.save();

    // also remove event._id from user.attendingEvents
    const user = await User.findById(req.user._id);
    user.attendingEvents.pull(event._id);
    await user.save();

    return res.json({ message: 'You have left the event', event });
  } catch (err) {
    console.error('Unattend =>', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// routes/events.js (partial)

router.post('/:eventId/cohost/request', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body; // The user we want to invite as co-host

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Must be the host to request co-host
    if (String(event.host) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the host can request co-hosts' });
    }

    // If user is already a co-host or already in coHostRequests, skip
    if (event.coHosts.includes(userId)) {
      return res.status(400).json({ message: 'User is already a co-host' });
    }
    if (!event.coHostRequests) {
      event.coHostRequests = [];
    }
    if (event.coHostRequests.includes(userId)) {
      return res.status(400).json({ message: 'Co-host request already pending' });
    }

    // Push to a coHostRequests array
    event.coHostRequests.push(userId);
    await event.save();

    return res.json({
      message: 'Co-host request sent',
      event,
    });
  } catch (error) {
    console.error('cohost/request error =>', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/cohost/accept', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is in coHostRequests
    if (!event.coHostRequests || !event.coHostRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'No co-host request found for you' });
    }

    // Remove from coHostRequests
    event.coHostRequests = event.coHostRequests.filter(
      (id) => String(id) !== String(req.user._id)
    );

    // Add to coHosts
    if (!event.coHosts.includes(req.user._id)) {
      event.coHosts.push(req.user._id);
    }

    // Also add them to attendees => no payment needed
    if (!event.attendees.includes(req.user._id)) {
      event.attendees.push(req.user._id);
    }

    await event.save();

    // Possibly notify the host or others that user accepted
    return res.json({
      message: 'You are now co-hosting this event.',
      event,
    });
  } catch (err) {
    console.error('cohost/accept error =>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/banUser', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, banPermanently } = req.body; 
    // 'banPermanently' is a boolean: if true => user added to bannedUsers array

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Must be host or co-host to ban
    const isHost = String(event.host) === String(req.user._id);
    const isCoHost = event.coHosts?.some(
      (cId) => String(cId) === String(req.user._id)
    );

    if (!isHost && !isCoHost) {
      return res.status(403).json({ message: 'Not authorized to ban users' });
    }

    // Ensure the user we want to ban is an attendee OR at least valid
    if (!event.attendees.includes(userId)) {
      // Possibly they’re not even in the attendee list, handle that
      return res.status(400).json({ message: 'User is not an attendee' });
    }

    // Remove from attendees
    event.attendees = event.attendees.filter(
      (attId) => String(attId) !== String(userId)
    );

    // If we want to ban them permanently => push to bannedUsers
    if (banPermanently) {
      if (!event.bannedUsers) {
        event.bannedUsers = [];
      }
      if (!event.bannedUsers.includes(userId)) {
        event.bannedUsers.push(userId);
      }
    }

    await event.save();

    // Also remove the event from the user's `attendingEvents` list
    const user = await User.findById(userId);
    if (user) {
      user.attendingEvents = user.attendingEvents.filter(
        (evtId) => String(evtId) !== String(event._id)
      );
      await user.save();
    }

    return res.json({
      message: banPermanently
        ? 'User has been banned and removed from attendees'
        : 'User removed from attendees',
      event
    });
  } catch (err) {
    console.error('banUser error =>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/mine/past', protect, async (req,res)=>{
  const events = await Event.find({
    attendees: req.user._id,
    time     : { $lt: new Date() }
  }).sort({ time:-1 });
  res.json(events);
});

module.exports = router;