import { useParams } from 'react-router-dom';

export default function Space() {
  const { id } = useParams();
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>会话</h1>
      <p>会话区占位。会话 id: {id ?? '—'}</p>
    </div>
  );
}
