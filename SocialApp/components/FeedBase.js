// components/FeedBase.js
import React, { useEffect, useState, useContext } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text,
} from 'react-native';
import api             from '../services/api';
import PostItem        from '../components/PostItem';
import EventCard       from '../components/EventCard';
import { AuthContext } from '../services/AuthContext';

export default function FeedBase({ navigation, filter }) {
  const { currentUser } = useContext(AuthContext);
  const uid             = currentUser?._id;

  const [data,setData]         = useState([]);
  const [page,setPage]         = useState(1);
  const [pages,setPages]       = useState(1);
  const [load,setLoad]         = useState(true);
  const [refresh,setRefresh]   = useState(false);

  useEffect(() => { fetchPage(1); }, [filter]);

  const fetchPage = async (p, isRef=false) => {
    try{
      isRef? setRefresh(true): setLoad(true);
      console.log('🟡 [FeedBase] hit /feed page',p,'filter',filter);
      const res = await api.get(`/feed?page=${p}&limit=12`);
      console.log('🟢  status',res.status,'raw len',res.data.feed?.length);

      const list = (res.data.feed||[]).filter(i =>
        filter==='posts'  ? i.uploadDate :
        filter==='events' ? i.time       : true);

      console.log('🟡  after filter len',list.length);

      if(p===1) setData(list); else setData(prev=>[...prev,...list]);
      setPage(res.data.page);
      setPages(res.data.totalPages);
    }catch(e){
      console.log('❌ [FeedBase] error',e.response?.data||e.message);
      if(p===1) setData([]);
    }finally{
      isRef? setRefresh(false): setLoad(false);
    }
  };

  const render = ({item}) =>
    item.uploadDate
      ? <PostItem  post={item} currentUserId={uid} navigation={navigation}/>
      : <EventCard event={item} currentUserId={uid} navigation={navigation}/>;

  return(
    <View style={styles.flex}>
      {load&&page===1 ? (
        <ActivityIndicator size="large" style={styles.center}/>
      ) : data.length===0 ? (
        <View style={styles.center}><Text>No feed items.</Text></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={i=>i._id}
          renderItem={render}
          onEndReached={()=>page<pages&&fetchPage(page+1)}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refresh} onRefresh={()=>fetchPage(1,true)}/>
          }
        />
      )}
    </View>
  );
}
const styles=StyleSheet.create({
  flex:{flex:1},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
});