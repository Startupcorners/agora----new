
//this is the implementation
//when the page loaded
window.addEventListener("load", (event) => {
    console.log("loaded");

    //get uid and channelName from url query params
    const urlParams = new URLSearchParams(window.location.search);

    if (!urlParams.get('channelName')) {
        alert('please provide channelName first');
    }

    if (!urlParams.get('uid')) {
        alert('please provide uid first');
    }

    //init the MainApp this is from main.js
    const app = MainApp({
        debugEnabled: false,
        appId: '88eb7ea8de544d68a718601966c086ce',
        callContainerSelector: '#user-streams',
        participantPlayerContainer: `<div class="video-containers" id="video-wrapper-{{uid}}">
        <p class="user-uid" uid="{{uid}}"><img class="volume-icon" id="volume-{{uid}}" src="./assets/volume-on.svg" /> {{uid}}</p>
        <div class="video-player player" id="stream-{{uid}}"></div>
  </div>`,
        serverUrl: 'https://startupcorners-server-token.vercel.app',
        channelName: urlParams.get('channelName'),
        uid: urlParams.get('uid'),
        onParticipantsChanged: (participantIds) => {
            console.log('current participants: ');
            console.log(participantIds);
            //todo send to bubble here
        },
        onVolumeIndicatorChanged: (volume) => {
            if (volume.level > 0) {
                document.querySelector(`#volume-${volume.uid}`).src = './assets/volume-on.svg';
            } else {
                document.querySelector(`#volume-${volume.uid}`).src = './assets/volume-off.svg';
            }
        },
        onParticipantLeft: (user) => {
            document.querySelector(`#video-wrapper-${user.uid}`).remove();
        }
    });
    const config = app.config;

    /**
     * Event Handlers
     */
    document.querySelector('#join-btn').addEventListener('click', async () => {
        document.querySelector('#join-wrapper').style.display = 'none'
        document.querySelector('#footer').style.display = 'flex'

        await app.join();
    })

    document.querySelector('#leave-btn').addEventListener('click', async () => {
        document.querySelector('#footer').style.display = 'none';
        document.querySelector('#join-wrapper').style.display = 'block';

        await app.leave();

    })

    document.querySelector('#mic-btn').addEventListener('click', async () => {
        await app.toggleMic();

        if (config.localAudioTrackMuted) {
            document.querySelector('#mic-btn').style.backgroundColor = 'rgb(255, 80, 80, 0.7)'
        } else {
            document.querySelector('#mic-btn').style.backgroundColor = '#1f1f1f8e'
        }
    })

    document.querySelector('#camera-btn').addEventListener('click', async () => {
        await app.toggleCamera();

        if (config.localVideoTrackMuted) {
            document.querySelector('#camera-btn').style.backgroundColor = 'rgb(255, 80, 80, 0.7)'
        } else {
            document.querySelector('#camera-btn').style.backgroundColor = '#1f1f1f8e'

        }
    })

    document.querySelector('#screen-share-btn').addEventListener('click', async () => {
        await app.toggleScreenShare();

        if (config.localScreenShareEnabled) {
            document.querySelector('#screen-share-btn').style.backgroundColor = 'rgb(255, 80, 80, 0.7)'
        } else {
            document.querySelector('#screen-share-btn').style.backgroundColor = '#1f1f1f8e'
        }
    })
});