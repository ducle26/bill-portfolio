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
| Record player | `assets/js/site.js` (the corner player) and `radio/index.html` (the pop-out) |
| Journey map (home) | `assets/js/journeymap.js` (the route and the small plane) |
| Mini Bill, the guide (home) | `assets/js/minime.js` (his lines are in `STOPS` at the top; the song is in `TUNE` and `WORDS`) |
| Resume download | `assets/resume/Duc_Le_Resume.pdf` (the public copy: no phone, no email, no Oliden figures) |
| Career log (resume) | `assets/js/careerlog.js` |
| Colors | `styles/light.scss` and `styles/dark.scss` |
| Layout and look | `styles/site.css` |
| Menu and footer | `_quarto.yml` |

## To-do list for Bill

- **B-side songs:** the YouTube video ids are in two places, `PICKS` in `assets/js/site.js` and `youtubeVideos` in `radio/index.html`. Keep them the same.
- **Music:** the A-side plays the tracks listed in `assets/audio/playlist.js`. Put the mp3 files in `assets/audio/` and add one line per track there. While the list is empty, the site plays its built-in music. Music starts at 35% volume from the entrance choice on the home page, or on the visitor's first click elsewhere. Pausing lasts for that visit only.
- **Personal page:** photos and a line for each place, plus hobbies.
- **Notes:** the three note titles are placeholders.
- **Projects:** each project page links to `github.com/ducle26/<repo>`. Create those repos as you finish each one.

## Later list

- **Vietnamese version:** removed for now. Brainstorm the voice and wording first so it reads naturally to a native speaker, then add it back.
- **Game leaderboard:** shared scores need a small free database (Firebase was the plan). Scores are saved per device for now.
- **Live rig on every page:** a small version to replace the depth ruler.

## Adding R to a project page

Project pages are R Markdown in all but name (`.qmd`). Add a chunk like this and Quarto runs it when you render:

```{r}
library(tidyverse)
```

## Publish on GitHub Pages

1. Make a repo named `your-username.github.io` and upload this whole folder.
2. In the repo: Settings > Pages > Deploy from a branch > `main` / `docs`.
3. After any change: run `quarto render`, then commit and push.
