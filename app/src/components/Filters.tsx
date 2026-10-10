import { useEffect, useState } from 'react';
import { getAgents } from '../api';
import { navigate } from '../useUrlState';
import { useFetch } from '../useFetch';

interface Props {
  q: string;
  agent: string;
  status: string;
}

export function Filters({ q, agent, status }: Props) {
  const [text, setText] = useState(q);
  const agents = useFetch((signal) => getAgents(signal), 'agents');

  // URL -> input (back/forward, copied links)
  useEffect(() => {
    setText((prev) => (prev.trim() === q ? prev : q));
  }, [q]);

  // input -> URL, debounced, without adding history entries
  useEffect(() => {
    if (text.trim() === q) return;
    const timer = setTimeout(() => navigate({ q: text.trim() }, 'replace'), 300);
    return () => clearTimeout(timer);
  }, [text, q]);

  const list = agents.data ?? [];
  const options = agent && !list.includes(agent) ? [agent, ...list] : list;

  return (
    <div className="filters" role="search">
      <input
        type="search"
        placeholder="Search agent, tool or args"
        aria-label="Search events"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <select aria-label="Filter by agent" value={agent} onChange={(e) => navigate({ agent: e.target.value })} disabled={agents.loading}>
        <option value="">{agents.loading ? 'Loading agents…' : 'All agents'}</option>
        {options.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select aria-label="Filter by status" value={status} onChange={(e) => navigate({ status: e.target.value })}>
        <option value="">All statuses</option>
        <option value="ok">ok</option>
        <option value="blocked">blocked</option>
        <option value="error">error</option>
      </select>

      {(q || agent || status) && (
        <button onClick={() => navigate({ q: '', agent: '', status: '' })}>Clear</button>
      )}

      {agents.error && (
        <span role="alert" className="muted">
          Couldn't load agents. <button onClick={agents.reload}>Retry</button>
        </span>
      )}
    </div>
  );
}