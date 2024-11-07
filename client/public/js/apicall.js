export const sendParticipantUpdate = async (event, user, profile, email, name, designation, company) => {
  try {
    const response = await fetch('https://www.startupcorners.com/version-test/api/1.1/wf/participantupdate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        user,
        profile,
        email,
        name,
        designation,
        company,
      }),
    });

    const result = await response.json();
    console.log('Participant update response:', result);
  } catch (error) {
    console.error('Error sending participant update:', error);
  }
};
