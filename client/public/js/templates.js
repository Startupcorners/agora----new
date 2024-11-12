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
      <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted">
        <img src="https://startupcorners-df3e7.web.app/icons/mic-muted.svg" alt="Mic Muted Icon" class="mic-icon" />
      </span>

    </div>
  </div>
`;
