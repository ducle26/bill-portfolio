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
| Journey map (home) | `assets/js/journeymap.js` |
| Career log (resume) | `assets/js/careerlog.js` |
| Colors | `styles/light.scss` and `styles/dark.scss` |
| Layout and look | `styles/site.css` |
| Menu and footer | `_quarto.yml` |

Vietnamese text sits in `data-vi="..."` next to the English. Edit both when you change a line.

## To-do list for Bill

- **B-side songs:** the YouTube video ids are in two places, `PICKS` in `assets/js/site.js` and `youtubeVideos` in `radio/index.html`. Keep them the same.
- **Music:** the A-side is the site's own music (`assets/js/field.js`). It starts at 35% volume about 2.5 seconds in, or on the visitor's first click if the browser is holding sound back. Pressing the record player stops it, and the site remembers.
- **Personal page:** photos and a line for each place, plus hobbies.
- **Notes:** the three note titles are placeholders.
- **Projects:** each project page links to `github.com/ducle26/<repo>`. Create those repos as you finish each one.

## Adding R to a project page

Project pages are R Markdown in all but name (`.qmd`). Add a chunk like this and Quarto runs it when you render:

```{r}
library(tidyverse)
```

## Publish on GitHub Pages

1. Make a repo named `your-username.github.io` and upload this whole folder.
2. In the repo: Settings > Pages > Deploy from a branch > `main` / `docs`.
3. After any change: run `quarto render`, then commit and push.
