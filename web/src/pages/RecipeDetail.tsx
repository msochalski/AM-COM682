import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addComment, deleteRecipe, getComments, getRecipe, publishRecipe, Recipe } from "../api";

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [comments, setComments] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    getRecipe(id)
      .then(setRecipe)
      .catch((err: Error) => setStatus(err.message));

    getComments(id)
      .then((data) => setComments(data.items ?? []))
      .catch((err: Error) => setStatus(err.message));
  }, [id]);

  const handlePublish = async () => {
    if (!id) {
      return;
    }
    setStatus("Publishing...");
    try {
      await publishRecipe(id);
      const updated = await getRecipe(id);
      setRecipe(updated);
      setStatus("Publish request sent for moderation.");
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!id) {
      return;
    }
    if (!confirm("Delete this recipe?")) {
      return;
    }
    try {
      await deleteRecipe(id);
      navigate("/");
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !commentText.trim()) {
      return;
    }
    try {
      await addComment(id, commentText.trim());
      setCommentText("");
      const data = await getComments(id);
      setComments(data.items ?? []);
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  if (!recipe) {
    return <p className="status">Loading recipe...</p>;
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{recipe.title}</h2>
          <p className="meta">
            {recipe.moderation_status ? `Status: ${recipe.moderation_status}` : "Draft"}
          </p>
        </div>
        <div className="actions">
          <Link className="ghost" to={`/recipes/${recipe.id}/edit`}>
            Edit
          </Link>
          <button className="ghost" onClick={handlePublish}>
            Publish
          </button>
          <button className="danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {status && <p className="status">{status}</p>}

      <div className="detail-grid">
        <div className="media">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={recipe.title} />
          ) : recipe.thumb_url ? (
            <img src={recipe.thumb_url} alt={recipe.title} />
          ) : (
            <div className="image-placeholder">Image processing in progress</div>
          )}
        </div>
        <div>
          <p className="lead">{recipe.description || "No description provided."}</p>
          <div className="tags">
            {recipe.categories?.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
          <h3>Instructions</h3>
          <p className="body-text">{recipe.instructions || "No instructions yet."}</p>
        </div>
      </div>

      <div className="divider" />

      <div className="comments">
        <h3>Comments</h3>
        <form className="comment-form" onSubmit={handleComment}>
          <textarea
            rows={3}
            placeholder="Leave a comment"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
          />
          <button type="submit">Send</button>
        </form>
        <div className="comment-list">
          {comments.map((comment) => (
            <div key={comment.id} className="comment">
              <p>{comment.text}</p>
              <span>{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}