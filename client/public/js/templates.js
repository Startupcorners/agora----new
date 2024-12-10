export const templateVideoParticipant = `
  <div id="video-wrapper-{{uid}}" class="video-participant" data-uid="{{uid}}">
    <!-- Video Player -->
    <!-- User Avatar (shown when video is off) -->
    <img id="avatar-{{uid}}" class="user-avatar" src="{{avatar}}" alt="{{name}}'s avatar" />
    <div id="stream-{{uid}}" class="video-player"></div>

    <!-- User Name with Mic Icon -->
    <div id="name-{{uid}}" class="user-name">
      {{name}}
      <!-- Microphone Status Icon within user name -->
      <span id="mic-status-{{uid}}" class="mic-status" title="Microphone is muted" margin-left: 5px;">
        <img src="https://startupcorners-df3e7.web.app/icons/mic-muted.svg" alt="Mic Muted Icon" class="mic-icon" />
      </span>
    </div>
  </div>
`;

export const templateVideoParticipantScreenshare = `
  <div id="video-wrapper-{{uid}}" class="video-participant" data-uid="{{uid}}">
    <!-- Video Player -->
    <!-- User Avatar (shown when video is off) -->
    <img id="avatar-{{uid}}" class="user-avatar-screenshare" src="{{avatar}}" alt="{{name}}'s avatar" />
    <div id="stream-{{uid}}" class="video-player"></div>

    <!-- User Name with Mic Icon -->
    <div id="name-{{uid}}" class="user-name-screenshare">
      {{name}}
      <!-- Microphone Status Icon within user name -->
      <span id="mic-status-{{uid}}" class="mic-status-screenshare" title="Microphone is muted" margin-left: 5px;">
        <img src="https://startupcorners-df3e7.web.app/icons/mic-muted.svg" alt="Mic Muted Icon" class="mic-icon-screenshare" />
      </span>
    </div>
  </div>
`;
