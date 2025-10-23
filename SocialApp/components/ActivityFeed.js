// components/ActivityFeed.js - Clean container following EventsHub pattern
import React, { forwardRef } from 'react';
import ActivityFeedContainer from './ActivityFeedContainer';

const ActivityFeed = forwardRef((props, ref) => {
  return <ActivityFeedContainer {...props} ref={ref} />;
});

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;