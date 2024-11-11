export const templateVideoParticipant = `
  <div id="video-wrapper-{{uid}}" class="video-participant" data-uid="{{uid}}">
    <!-- Video Player -->
    <div id="stream-{{uid}}" class="video-player"></div>

    <!-- User Avatar (shown when video is off) -->
    <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" />

    <!-- User Name -->
    <div id="name-{{uid}}" class="user-name">
      {{name}}
    </div>

    <!-- Participant Status Indicators -->
    <div class="status-indicators">
      <!-- Microphone Status Icon -->
      <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted"></span>

      <!-- Camera Status Icon -->
      <span id="cam-status-{{uid}}" class="cam-status" title="Camera is off"></span>
    </div>
  </div>
`;
