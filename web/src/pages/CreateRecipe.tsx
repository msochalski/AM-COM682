import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { createRecipe, getRecipe, uploadInit, uploadToSas } from "../api";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CreateRecipe() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [categories, setCategories] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("Preparing upload...");

    try {
      let rawBlobName: string | undefined;
      if (file) {
        const init = await uploadInit(file);
        await uploadToSas(init.uploadUrl, file);
        rawBlobName = init.blobName;
      }

      setStatus("Creating recipe...");
      const recipe = await createRecipe({
        title,
        description,
        instructions,
        categories: categories
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        raw_image_blob_name: rawBlobName
      });

      setRecipeId(recipe.id);
      if (rawBlobName) {
        setStatus("Processing image...");
        await pollForThumb(recipe.id);
      } else {
        setStatus("Recipe created.");
      }
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const pollForThumb = async (id: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(2000);
      const recipe = await getRecipe(id);
      if (recipe.thumb_url || recipe.image_url) {
        setStatus("Image ready.");
        return;
      }
    }
    setStatus("Still processing image. Check back later.");
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Create recipe</h2>
          <p>Uploads go direct to Storage with SAS.</p>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          Instructions
          <textarea
            rows={5}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </label>
        <label>
          Categories (comma separated)
          <input value={categories} onChange={(event) => setCategories(event.target.value)} />
        </label>
        <label>
          Image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit">Create recipe</button>
      </form>

      {status && <p className="status">{status}</p>}
      {recipeId && (
        <p className="status">
          View recipe: <Link to={`/recipes/${recipeId}`}>{recipeId}</Link>
        </p>
      )}
    </section>
  );
}