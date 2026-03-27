import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/auth';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clampIndex(value, length) {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (length <= 0) return 0;
  if (value >= length) return length - 1;
  return value;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const [activeBoard, setActiveBoard] = useState(0);
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeClue, setActiveClue] = useState(0);

  // Snapshot of last-saved content to detect dirtiness
  const savedSnapshot = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch('/api/content', {}, true);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Ensure every board has a multiplier
        for (const board of (data.boards ?? [])) {
          if (board.multiplier == null) board.multiplier = 1;
        }
        setContent(data);
        savedSnapshot.current = JSON.stringify(data);
      } catch (err) {
        const msg = err?.message || 'Failed to load content';
        setError(msg);
        if (msg.toLowerCase().includes('sign in')) navigate('/host', { replace: true });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  function markDirty() {
    setDirty(true);
    setSavedMsg('');
    setConfirmExit(false);
  }

  function updateBoard(boardIndex, patch) {
    setContent((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      Object.assign(next.boards[boardIndex], patch);
      return next;
    });
    markDirty();
  }

  function updateCategory(boardIndex, categoryIndex, patch) {
    setContent((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      Object.assign(next.boards[boardIndex].categories[categoryIndex], patch);
      return next;
    });
    markDirty();
  }

  function updateClue(boardIndex, categoryIndex, clueIndex, patch) {
    setContent((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      Object.assign(next.boards[boardIndex].categories[categoryIndex].clues[clueIndex], patch);
      return next;
    });
    markDirty();
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setSavedMsg('');
    setError('');
    try {
      const res = await apiFetch('/api/content', {
        method: 'POST',
        body: JSON.stringify(content),
      }, true);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMsg('Saved');
      setDirty(false);
      setConfirmExit(false);
      savedSnapshot.current = JSON.stringify(content);
    } catch (err) {
      setError(err?.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  }

  async function onQuestionImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !content || !category || !clue) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateClue(boardIndex, categoryIndex, clueIndex, { questionImageUrl: dataUrl });
    } catch (err) {
      setError(err?.message || 'Failed to load image');
    } finally {
      e.target.value = '';
    }
  }

  function handleHome() {
    if (!dirty) {
      navigate('/host');
      return;
    }
    if (confirmExit) {
      // Second press — exit without saving
      navigate('/host');
      return;
    }
    // First press — show warning
    setConfirmExit(true);
    setSavedMsg('');
  }

  if (loading) {
    return (
      <section className="editorWorkbenchShell">
        <div className="editorWorkbenchStatusCard">Loading…</div>
      </section>
    );
  }

  if (!content) {
    return (
      <section className="editorWorkbenchShell">
        <div className="editorWorkbenchStatusCard editorWorkbenchDanger">No content loaded.</div>
      </section>
    );
  }

  const boardCount = content.boards?.length ?? 0;
  const boardIndex = clampIndex(activeBoard, boardCount);
  const board = content.boards?.[boardIndex];

  const categories = board?.categories ?? [];
  const categoryIndex = clampIndex(activeCategory, categories.length);
  const category = categories?.[categoryIndex];

  const clues = category?.clues ?? [];
  const clueIndex = clampIndex(activeClue, clues.length);
  const clue = clues?.[clueIndex];

  return (
    <section className="editorWorkbenchShell">
      <header className="editorWorkbenchTopbar">
        <div>
          <h1 className="editorWorkbenchTitle">Editor</h1>
          <p className="editorWorkbenchSubtitle">Browse boards and edit clues.</p>
        </div>
        <div className="editorTopButtons">
          <button className="btn" type="button" onClick={handleHome}>
            Home
          </button>
          <button className="btn" type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="editorWorkbenchNotices">
        <span className="editorWorkbenchError">{error}</span>
        {confirmExit ? (
          <span className="editorWorkbenchWarning" style={{ animation: 'fadeIn 0.3s var(--ease)' }}>
            Are you sure? Unsaved changes.
          </span>
        ) : (
          <span className="editorWorkbenchSaved">{savedMsg}</span>
        )}
      </div>

      <div className="editorWorkbenchLayout">
        <nav className="editorWorkbenchTreePanel" aria-label="Content tree">
          <div className="editorWorkbenchPanelHeading">Content</div>
          <div className="editorWorkbenchTreeScroll">
            {(content.boards ?? []).map((b, bIdx) => (
              <section key={`tree-b-${bIdx}`} className="editorWorkbenchBranch">
                <button
                  type="button"
                  className={'editorWorkbenchTreeButton depth0' + (boardIndex === bIdx ? ' active' : '')}
                  onClick={() => { setActiveBoard(bIdx); setActiveCategory(0); setActiveClue(0); }}
                >
                  Board {bIdx + 1}
                </button>

                {(b.categories ?? []).map((cat, cIdx) => (
                  <div key={`tree-c-${bIdx}-${cIdx}`} className="editorWorkbenchBranch">
                    <button
                      type="button"
                      className={'editorWorkbenchTreeButton depth1' + (boardIndex === bIdx && categoryIndex === cIdx ? ' active' : '')}
                      onClick={() => { setActiveBoard(bIdx); setActiveCategory(cIdx); setActiveClue(0); }}
                    >
                      {cat.name?.trim() ? cat.name : `Category ${cIdx + 1}`}
                    </button>
                    {(cat.clues ?? []).map((_, qIdx) => (
                      <button
                        key={`tree-q-${bIdx}-${cIdx}-${qIdx}`}
                        type="button"
                        className={'editorWorkbenchTreeButton depth2' + (boardIndex === bIdx && categoryIndex === cIdx && clueIndex === qIdx ? ' active' : '')}
                        onClick={() => { setActiveBoard(bIdx); setActiveCategory(cIdx); setActiveClue(qIdx); }}
                      >
                        Clue {qIdx + 1}
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </nav>

        <article className="editorWorkbenchFormPanel">
          {category && clue ? (
            <>
              <div className="editorWorkbenchPath">
                Board {boardIndex + 1} / {category.name || `Category ${categoryIndex + 1}`} / Clue {clueIndex + 1}
              </div>

              <div className="editorWorkbenchInputRow">
                <label className="editorWorkbenchLabel" htmlFor="editor-category-name">Category</label>
                <input
                  id="editor-category-name"
                  type="text"
                  value={category.name}
                  onChange={(e) => updateCategory(boardIndex, categoryIndex, { name: e.target.value })}
                />
              </div>

              <div className="editorWorkbenchInputRow editorWorkbenchPointsRow">
                <label className="editorWorkbenchLabel" htmlFor="editor-points">Points</label>
                <input
                  id="editor-points"
                  type="number"
                  value={clue.value}
                  onChange={(e) => updateClue(boardIndex, categoryIndex, clueIndex, { value: Number(e.target.value) })}
                />
                <label className="editorWorkbenchLabel" htmlFor="editor-multiplier">Board Multiplier</label>
                <input
                  id="editor-multiplier"
                  type="number"
                  value={board?.multiplier ?? 1}
                  min={1}
                  onChange={(e) => updateBoard(boardIndex, { multiplier: Number(e.target.value) || 1 })}
                />
              </div>

              <div className="editorWorkbenchPromptGrid">
                <section className="editorWorkbenchTextSection">
                  <label className="editorWorkbenchLabel" htmlFor="editor-question">Question</label>
                  <textarea
                    id="editor-question"
                    className="editorWorkbenchTextarea"
                    value={clue.questionText}
                    onChange={(e) => updateClue(boardIndex, categoryIndex, clueIndex, { questionText: e.target.value })}
                  />
                </section>

                <section className="editorWorkbenchTextSection">
                  <label className="editorWorkbenchLabel" htmlFor="editor-answer">Answer</label>
                  <textarea
                    id="editor-answer"
                    className="editorWorkbenchTextarea"
                    value={clue.answerText ?? ''}
                    onChange={(e) => updateClue(boardIndex, categoryIndex, clueIndex, { answerText: e.target.value })}
                  />
                </section>
              </div>

              <div className="editorWorkbenchTextSection">
                <label className="editorWorkbenchLabel" htmlFor="editor-question-image-url">Question Image URL</label>
                <input
                  id="editor-question-image-url"
                  type="text"
                  placeholder="https://... or leave blank"
                  value={clue.questionImageUrl ?? ''}
                  onChange={(e) => updateClue(boardIndex, categoryIndex, clueIndex, { questionImageUrl: e.target.value })}
                />
              </div>

              <div className="editorWorkbenchTextSection">
                <label className="editorWorkbenchLabel" htmlFor="editor-question-image-file">Upload Question Image</label>
                <input
                  id="editor-question-image-file"
                  type="file"
                  accept="image/*"
                  onChange={onQuestionImageFileChange}
                />
                {clue.questionImageUrl ? (
                  <div className="editorQuestionImagePreviewWrap">
                    <img className="editorQuestionImagePreview" src={clue.questionImageUrl} alt="Question preview" />
                    <button
                      className="btn"
                      type="button"
                      onClick={() => updateClue(boardIndex, categoryIndex, clueIndex, { questionImageUrl: '' })}
                    >
                      Remove Image
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="small">No editable selection.</div>
          )}
        </article>
      </div>
    </section>
  );
}
