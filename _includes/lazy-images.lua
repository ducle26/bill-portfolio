-- Mark every chart image as lazy, so the browser fetches it only when it is
-- about to be seen. Each chart exists twice (light and dark look), and this
-- keeps the hidden one from being downloaded at all.
function Image(img)
  img.attributes["loading"] = "lazy"
  return img
end
