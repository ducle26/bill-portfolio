# Blueprint chart style, shared by every case study on this site.
#
# The site has two looks: a light drafting sheet and a dark blueprint print.
# Each chart is drawn twice, once per look, and the page shows the one that
# matches the reader's theme. In the case study code that looks like:
#
#   bp_both(function(k) {
#     ggplot(d, aes(x, y)) + geom_point(colour = k$mark)
#   })
#
# `k` holds the colors for the look being drawn.

library(ggplot2)

# ---- Colors -----------------------------------------------------------------
# Paper and ink match styles/light.scss and styles/dark.scss.
# The three series colors were checked for color-blind separation and for
# contrast against each paper color.
bp_colors <- list(
  light = list(
    mode = "light", paper = "#F6F7F5", ink = "#13233A", ink2 = "#4A5A70",
    ink3 = "#5F6C7D", grid = "#D9DFE6", axis = "#9AA6B4",
    mark = "#2B5FA8", soft = "#A9BFDD",
    series = c("#2B5FA8", "#B5832A", "#0E9F97"),
    seq = c("#C5D5EA", "#6E94C6", "#2B5FA8", "#0B1F3F")
  ),
  dark = list(
    mode = "dark", paper = "#0F2C52", ink = "#EAF1FB", ink2 = "#B9CBE3",
    ink3 = "#8EA6C6", grid = "#2A4A76", axis = "#5F7FA8",
    mark = "#7DB8F5", soft = "#3F6FA8",
    series = c("#7DB8F5", "#D9A441", "#2FBF9F"),
    seq = c("#27508A", "#4F86C6", "#9CC8F7", "#FFFFFF")
  )
)

# ---- Fonts ------------------------------------------------------------------
# Use the site's own typefaces when the font files are in the project.
# If they are missing, the charts fall back to the default sans font.
bp_font <- local({
  fam <- list(sans = "sans", mono = "mono")
  dir <- NULL
  for (p in c("_fonts", "projects/_fonts", "../projects/_fonts")) {
    if (file.exists(file.path(p, "space-grotesk-400.ttf"))) { dir <- p; break }
  }
  if (!is.null(dir) && requireNamespace("systemfonts", quietly = TRUE) &&
      requireNamespace("ragg", quietly = TRUE)) {
    ok <- tryCatch({
      known <- systemfonts::registry_fonts()$family
      if (!"BP Grotesk" %in% known) {
        systemfonts::register_font("BP Grotesk",
          plain = file.path(dir, "space-grotesk-400.ttf"),
          bold  = file.path(dir, "space-grotesk-500.ttf"))
      }
      if (!"BP Mono" %in% known) {
        systemfonts::register_font("BP Mono",
          plain = file.path(dir, "space-mono-400.ttf"),
          bold  = file.path(dir, "space-mono-700.ttf"))
      }
      TRUE
    }, error = function(e) FALSE)
    if (ok) fam <- list(sans = "BP Grotesk", mono = "BP Mono")
  }
  fam
})

# ---- Drawing device ---------------------------------------------------------
# Charts are saved with a see-through background so the page's paper shows.
# The ragg device draws the custom fonts; without it, R's own png device is used.
bp_device <- function() {
  if (requireNamespace("ragg", quietly = TRUE)) {
    knitr::opts_chunk$set(dev = "ragg_png", dev.args = list(background = "transparent"))
  } else {
    knitr::opts_chunk$set(dev = "png", dev.args = list(bg = "transparent"))
  }
}

# ---- Theme ------------------------------------------------------------------
theme_bp <- function(k, base_size = 13) {
  theme_minimal(base_size = base_size, base_family = bp_font$sans) +
    theme(
      text = element_text(colour = k$ink),
      plot.background = element_rect(fill = NA, colour = NA),
      panel.background = element_rect(fill = NA, colour = NA),
      panel.grid.minor = element_blank(),
      panel.grid.major = element_line(colour = k$grid, linewidth = 0.3),
      axis.line = element_line(colour = k$axis, linewidth = 0.4),
      axis.ticks = element_line(colour = k$axis, linewidth = 0.4),
      axis.ticks.length = unit(4, "pt"),
      axis.text = element_text(colour = k$ink2, family = bp_font$mono, size = rel(0.78)),
      axis.title = element_text(colour = k$ink2, family = bp_font$mono, size = rel(0.78)),
      axis.title.x = element_text(margin = ggplot2::margin(t = 8), hjust = 0),
      axis.title.y = element_text(margin = ggplot2::margin(r = 8), hjust = 1),
      plot.title = element_text(face = "bold", size = rel(1.12), lineheight = 1.15,
                                margin = ggplot2::margin(b = 6)),
      plot.title.position = "plot",
      plot.subtitle = element_text(colour = k$ink2, size = rel(0.9), lineheight = 1.2,
                                   margin = ggplot2::margin(b = 12)),
      plot.caption = element_text(colour = k$ink3, family = bp_font$mono, size = rel(0.68),
                                  hjust = 0, margin = ggplot2::margin(t = 10)),
      plot.caption.position = "plot",
      legend.position = "top",
      legend.justification = "left",
      legend.title = element_blank(),
      legend.text = element_text(colour = k$ink2, family = bp_font$mono, size = rel(0.8)),
      legend.key = element_rect(fill = NA, colour = NA),
      legend.margin = ggplot2::margin(0, 0, 0, 0),
      legend.box.margin = ggplot2::margin(0, 0, 2, 0),
      strip.text = element_text(colour = k$ink2, family = bp_font$mono, size = rel(0.8),
                                hjust = 0),
      plot.margin = ggplot2::margin(6, 14, 4, 4)
    )
}

# ---- Draw a chart for both looks --------------------------------------------
# `make` is a function that takes the colors `k` and returns a ggplot.
bp_both <- function(make, base_size = 13) {
  old <- theme_get()
  on.exit(theme_set(old))
  for (mode in c("light", "dark")) {
    k <- bp_colors[[mode]]
    theme_set(theme_bp(k, base_size))
    # Marks with no color set in the chart code pick up this look's ink.
    update_geom_defaults("point",   list(colour = k$mark))
    update_geom_defaults("line",    list(colour = k$mark))
    update_geom_defaults("col",     list(fill = k$mark))
    update_geom_defaults("bar",     list(fill = k$mark))
    update_geom_defaults("text",    list(colour = k$ink2, family = bp_font$mono))
    update_geom_defaults("label",   list(colour = k$ink2, family = bp_font$mono))
    update_geom_defaults("segment", list(colour = k$ink2))
    update_geom_defaults("abline",  list(colour = k$ink2))
    update_geom_defaults("hline",   list(colour = k$ink2))
    update_geom_defaults("vline",   list(colour = k$ink2))
    update_geom_defaults("path",    list(colour = k$ink2))
    update_geom_defaults("boxplot", list(colour = k$ink2, fill = NA))
    print(make(k))
  }
  invisible(NULL)
}

# Dollar labels in millions, for axes: 1.5 becomes "$1.5M".
bp_millions <- function(x) paste0("$", format(x, trim = TRUE, drop0trailing = TRUE), "M")
