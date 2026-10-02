# Bill's portfolio site

A Quarto website, built in R. The finished site lives in the `docs/` folder, which GitHub Pages serves.

## Open it

1. Unzip this folder somewhere easy, like `BZAN 6351/bill-portfolio`.
2. In RStudio: File > New Project > Existing Directory, and pick this folder.
3. In the Terminal tab, run `quarto preview`. The site opens in your browser and reloads when you save a file.

## Where things live

| To change | Edit |
|---|---|
| Home page | `index.qmd` |
| About Me | `about.qmd` |
| Resume | `resume.qmd` |
| Projects | `projects/*.qmd` (one file per case study) |
| Notes and Now | `notes.qmd` |
| Game | `play.qmd` and `assets/js/game.js` |
| Live well view (home) | `assets/js/drillview.js` |
| Music engine | `assets/js/field.js` (tracks, chords, tempo at the top) |
| Radio | `radio/index.html` (settings are at the top of the script) |
| Colors | `styles/light.scss` and `styles/dark.scss` |
| Layout and look | `styles/site.css` |
| Menu and footer | `_quarto.yml` |

Vietnamese text sits in `data-vi="..."` next to the English. Edit both when you change a line.

## To-do list for Bill

- **Headshot:** save it as `assets/img/headshot.jpg`, then follow the note in `about.qmd`.
- **YouTube playlist:** paste the playlist ID into `radio/index.html` (`youtubePlaylistId`).
- **Music:** the site plays its own chill music, made live in the browser (`assets/js/field.js`). It starts at half volume about 2.5 seconds in, or on the visitor's first click if the browser is still holding sound back. Visitors can turn it off with the Music button, and the site remembers. To add real tracks to the radio, put Pixabay mp3s in `assets/audio/` and list them in `fieldTracks` in `radio/index.html`.
- **GitHub link:** replace `https://github.com/` in `_quarto.yml` with your profile.
- **Check these facts:** the IA start date ("2026 to now"), the email shown, the Vietnam line in Journey, and the "Next" line.
- **Personal page:** photos and a line for each place, plus hobbies.

## Adding R to a project page

Project pages are R Markdown in all but name (`.qmd`). Add a chunk like this and Quarto runs it when you render:

```{r}
library(tidyverse)
```

## Publish on GitHub Pages

1. Make a repo named `your-username.github.io` and upload this whole folder.
2. In the repo: Settings > Pages > Deploy from a branch > `main` / `docs`.
3. After any change: run `quarto render`, then commit and push.
