import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipe, updateRecipe } from "../api";

export default function EditRecipe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [categories, setCategories] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    getRecipe(id)
      .then((recipe) => {
        setTitle(recipe.title ?? "");
        setDescription(recipe.description ?? "");
        setInstructions(recipe.instructions ?? "");
        setCategories((recipe.categories ?? []).join(", "));
      })
      .catch((err: Error) => setStatus(err.message));
  }, [id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) {
      return;
    }

    try {
      await updateRecipe(id, {
        title,
        description,
        instructions,
        categories: categories
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      });
      navigate(`/recipes/${id}`);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Edit recipe</h2>
          <p>Update the recipe fields and categories.</p>
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
        <button type="submit">Save changes</button>
      </form>

      {status && <p className="status">{status}</p>}
    </section>
  );
}