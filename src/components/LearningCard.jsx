import { BookOpen, Gamepad2, LockKeyhole, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { learningHref } from "../utils/studentProgress";

export default function LearningCard({ item }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGame = item.type === "game";
  const destination = learningHref(item);

  function openContent() {
    if (user) navigate(destination);
    else navigate("/login", { state: { from: destination } });
  }

  return (
    <article className="learning-card">
      <div className={`learning-icon ${isGame ? "game" : "lesson"}`}>{isGame ? <Gamepad2 /> : <BookOpen />}</div>
      <div className="learning-info">
        <span className="tag">{item.type}</span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="details"><span>{item.subject}</span><span>{item.grade}</span></div>
        <button className="card-action" type="button" onClick={openContent}>
          {user ? <Play size={16} /> : <LockKeyhole size={16} />} {user ? "Open" : "Login to access"}
        </button>
      </div>
    </article>
  );
}
