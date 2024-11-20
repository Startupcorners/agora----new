export const templateScreenShare = `
  <div id="screen-share-content" class="screen-share-content"></div>
  
  <!-- Small video of the person sharing their screen (PiP) -->
  <div id="screen-share-video-{{uid}}" class="screen-share-video">
    <!-- Video Player for PiP -->
    <div id="pip-video-track-{{uid}}" class="video-player"></div>
    
    <!-- Avatar for PiP when camera is off -->
    <img id="pip-avatar-{{uid}}" class="user-avatar" 
         src="{{avatar}}" 
         alt="User's avatar" />
  </div>
`;
