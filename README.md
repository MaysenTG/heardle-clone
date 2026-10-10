# Heardle Clone

A daily guess-the-song game. You hear the first second of a song, and each skip or wrong guess unlocks more (1, 2, 4, 7, 11, 16 seconds). Six tries. Stats and streaks are kept in your browser.

Play it: https://maysentg.github.io/heardle-clone/

## How the audio works

The app only stores iTunes track IDs. When the page loads it asks the iTunes Lookup API for that track and plays the 30-second preview Apple returns. No audio is stored or hosted here.

## Run it

    npm install
    npm run dev

## Notes

This is a non-commercial fan project with no ads. It is not affiliated with Apple, Spotify or the original Heardle. Apple's preview terms are written for promoting store content, so using previews in a game is a grey area. Every song links back to Apple Music.
