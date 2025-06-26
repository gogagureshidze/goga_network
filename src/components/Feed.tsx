import React from 'react'
import Post from './Post';

function Feed() {
  return (
    <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12">
      <Post />
      <Post />
      <Post />
    </div>
  );
}

export default Feed