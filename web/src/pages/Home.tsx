import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FeedItem, getFeed } from "../api";

export default function Home() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getFeed(1, 24)
      .then((data) => {
        if (active) {
          setItems(data.items ?? []);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Published feed</h2>
          <p>Auto-generated after media processing and moderation.</p>
        </div>
      </div>

      {loading && <p className="status">Loading feed...</p>}
      {error && <p className="status error">{error}</p>}

      <div className="grid">
        {items.map((item) => (
          <Link key={item.id} className="card" to={`/recipes/${item.recipeId}`}>
            <div className="card-image">
              {item.imageThumbUrl ? (
                <img src={item.imageThumbUrl} alt={item.title} />
              ) : (
                <div className="image-placeholder">No image</div>
              )}
            </div>
            <div className="card-body">
              <h3>{item.title}</h3>
              <div className="tags">
                {item.tags?.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && items.length === 0 && <p className="status">No feed items yet.</p>}
    </section>
  );
}