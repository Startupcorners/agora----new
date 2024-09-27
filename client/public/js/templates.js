// templates.js

export const templateVideoParticipant = `<div id="video-wrapper-{{uid}}" style="
  flex: 1 1 calc(25% - 20px); /* Ensure wrappers resize flexibly */
  width: 100%;
  min-width: 280px; /* Updated min-width */
  max-width: 800px;
  aspect-ratio: 16/9;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px;
  border-radius: 10px;
  background-color: #3c4043;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  transition: all 0.3s ease; /* Smooth transitions on resizing */
" data-uid="{{uid}}">
  <!-- Video Player -->
  <div id="stream-{{uid}}" class="video-player" style="
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: none; /* Initially hidden because the camera is off */
  "></div>

  <!-- User Avatar (shown when video is off) -->
  <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" style="
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
  " />

  <!-- User Name -->
  <div id="name-{{uid}}" class="user-name" style="
    position: absolute;
    bottom: 10px;
    left: 10px;
    font-size: 16px;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: 5px;
  ">
    {{name}}
  </div>

  <!-- Participant Status Indicators -->
  <div class="status-indicators" style="
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 5px;
  ">
    <!-- Microphone Status Icon -->
    <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted" style="
      width: 24px;
      height: 24px;
      background-image: url('https://startupcorners-df3e7.web.app/icons/mic-muted.svg');
      background-size: contain;
      background-repeat: no-repeat;
      display: none;
    "></span>

    <!-- Camera Status Icon -->
    <span id="cam-status-{{uid}}" class="cam-status" title="Camera is off" style="
      width: 24px;
      height: 24px;
      background-image: url('icons/camera-off.svg');
      background-size: contain;
      background-repeat: no-repeat;
      display: block;
    "></span>
  </div>
</div>
`;
