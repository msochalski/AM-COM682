export function getProcessedBlobNames(recipeId: string) {
  return {
    thumbName: `recipes/${recipeId}/thumb.webp`,
    imageName: `recipes/${recipeId}/image.webp`
  };
}