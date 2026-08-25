import React, { useEffect, useMemo, useState } from "react";
import ExerciseCard from "./ExerciseCard";
import { api } from "../lib/api";
import { exportTrainingToPdf } from "../lib/pdfExport";
import { exportTrainingFichaToPdf } from "../lib/pdfFicha";
import { isFichaTraining } from "../lib/trainingFicha";
import CreateExerciseModal from "./CreateExerciseModal";
import ConfirmModal from "./ConfirmModal";
import ExerciseDetailModal from "./ExerciseDetailModal";
import TrainingPlannerModal from "./TrainingPlannerModal";
import TrainingsPage from "./TrainingsPage";
import TeamHub from "./TeamHub";
import TeamStatsView from "./TeamStatsView";
import PlayerManagement from "./PlayerManagement";
import MatchManagement from "./MatchManagement";
import MatchTracker from "./MatchTracker";
import TacticalBoard from "./TacticalBoard";
import TeamCalendar from "./TeamCalendar";
import GlobalSearchModal from "./GlobalSearchModal";
import ExerciseForumModal from "./ExerciseForumModal";
import { ArrowLeftIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon, DumbbellIcon, LoaderIcon, CopyIcon, PasteIcon, CheckSquareIcon, XIcon } from "./Icons";
import { getExerciseClipboard, setExerciseClipboard } from "../lib/exerciseClipboard";

export default function TeamPage({ team, onBack }) {
  const [view, setView] = useState("hub"); // hub | exercises | trainings | board | roster | matches | stats | calendar
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [creatingTraining, setCreatingTraining] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState(null);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [trainings, setTrainings] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showExerciseFilters, setShowExerciseFilters] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [exerciseDateFrom, setExerciseDateFrom] = useState("");
  const [exerciseDateTo, setExerciseDateTo] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [clipboardCount, setClipboardCount] = useState(() => getExerciseClipboard().length);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const EXERCISES_PAGE_SIZE = 30;
  const [showSearch, setShowSearch] = useState(false);
  const [searchPlayerId, setSearchPlayerId] = useState(null);
  const [showForum, setShowForum] = useState(false);

  function handleSelectPlayerFromSearch(player) {
    setSearchPlayerId(player.id);
    setView("roster");
    setShowSearch(false);
  }

  function handleSelectExerciseFromSearch(exercise) {
    setDetailFor(exercise);
    setView("exercises");
    setShowSearch(false);
  }

  function handleSelectTrainingFromSearch() {
    setView("trainings");
    setShowSearch(false);
  }

  const normalizeExerciseName = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  function isDuplicateExerciseName(name, currentExerciseId = null) {
    const normalizedName = normalizeExerciseName(name);
    if (!normalizedName) return false;
    return exercises.some((exercise) => {
      if (currentExerciseId && exercise.id === currentExerciseId) return false;
      return normalizeExerciseName(exercise.name) === normalizedName;
    });
  }

  useEffect(() => {
    if (!team) return;
    setExercisesLoading(true);
    api.getExercises(team.id).then(exs => {
      setExercises(exs);
      setExercisesLoading(false);
    }).catch(() => setExercisesLoading(false));
    api.getPlayers(team.id).then(setPlayers);
    loadTrainingHistory(team.id);
  }, [team]);

  async function onToggleExerciseVisibility(exercise) {
    const updated = await api.updateExercise(exercise.id, { is_public: !exercise.is_public });
    setExercises((current) =>
      current.map((item) => (item.id === exercise.id ? { ...item, is_public: updated.is_public } : item)),
    );
    setDetailFor((current) =>
      current && current.id === exercise.id ? { ...current, is_public: updated.is_public } : current,
    );
  }

  async function onCreate(data) {
    if (isDuplicateExerciseName(data.name)) {
      alert("Ya existe un ejercicio con ese nombre. Usa otro distinto.");
      return;
    }
    const ex = await api.createExercise({ ...data, team_id: team.id });
    setExercises((s) => [ex, ...s]);
    setCreating(false);
  }

  async function onSaveEdit(data) {
    if (!editingExercise) return;
    if (isDuplicateExerciseName(data.name, editingExercise.id)) {
      alert("Ya existe un ejercicio con ese nombre. Usa otro distinto.");
      return;
    }
    const updated = await api.updateExercise(editingExercise.id, data);
    setExercises((current) =>
      current.map((item) => (item.id === editingExercise.id ? updated : item)),
    );
    setEditingExercise(null);
  }

  async function loadTrainingHistory(teamId) {
    const basicTrainings = await api.getTrainings(teamId);
    if (basicTrainings.length === 0) {
      setTrainings([]);
      return;
    }
    const itemsByTraining = await api.getTrainingItemsByTrainingIds(
      basicTrainings.map((t) => t.id),
    );
    setTrainings(
      basicTrainings.map((training) => ({
        ...training,
        items: itemsByTraining[training.id] || [],
      })),
    );
  }

  async function onCreateTraining(payload) {
    await api.createTraining({ team_id: team.id, ...payload });
    await loadTrainingHistory(team.id);
    setCreatingTraining(false);
  }

  async function onEditTraining(payload) {
    if (!editingTraining) return;
    await api.updateTraining(editingTraining.id, {
      training_date: payload.training_date,
      notes: payload.notes,
      attending_players: payload.selected_players,
      objectives: payload.objectives,
      warmup: payload.warmup,
    });
    await api.replaceTrainingItems(editingTraining.id, payload.items);
    await loadTrainingHistory(team.id);
    setEditingTraining(null);
  }

  async function onConfirmDeleteTraining() {
    if (!confirmDeleteTraining) return;
    await api.deleteTraining(confirmDeleteTraining.id);
    await loadTrainingHistory(team.id);
    setConfirmDeleteTraining(null);
  }

  async function exportSingleTraining(training) {
    try {
      if (!training) {
        alert("No hay datos para exportar");
        return;
      }
      if (!training.training_date) {
        alert("El entrenamiento no tiene fecha");
        return;
      }
      if (isFichaTraining(training)) {
        await exportTrainingFichaToPdf(
          training,
          players,
          exercises,
          team,
          trainings,
        );
        return;
      }
      if (!training.items || training.items.length === 0) {
        alert("El entrenamiento no tiene ejercicios");
        return;
      }
      await exportTrainingToPdf(training, players, team);
    } catch (error) {
      console.error("Error en exportSingleTraining:", error);
      alert("Error al exportar: " + (error.message || error));
    }
  }

  async function onDeleteExercise(exercise) {
    setConfirmFor(exercise);
  }

  function toggleSelectMode() {
    setSelectMode((s) => !s);
    setSelectedIds(new Set());
  }

  function toggleExerciseSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copySelectedToClipboard() {
    const toCopy = exercises
      .filter((ex) => selectedIds.has(ex.id))
      .map((ex) => ({
        name: ex.name,
        objective: ex.objective,
        category: ex.category,
        dimensions: ex.dimensions,
        photo_url: ex.photo_url,
      }));
    if (toCopy.length === 0) return;
    setExerciseClipboard(toCopy);
    setClipboardCount(toCopy.length);
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function pasteClipboardExercises() {
    const items = getExerciseClipboard();
    if (items.length === 0) return;
    setPasting(true);
    try {
      const pasted = [];
      for (const item of items) {
        const ex = await api.createExercise({ team_id: team.id, ...item });
        pasted.push(ex);
      }
      setExercises((current) => [...pasted, ...current]);
    } catch (error) {
      console.error("Error pegando ejercicios:", error);
      alert("Error al pegar ejercicios: " + (error.message || error));
    } finally {
      setPasting(false);
    }
  }

  async function deleteSelectedExercises() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) await api.deleteExercise(id);
      setExercises((current) => current.filter((ex) => !selectedIds.has(ex.id)));
      setSelectMode(false);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
    } catch (error) {
      console.error("Error eliminando ejercicios:", error);
      alert("Error al eliminar ejercicios: " + (error.message || error));
    } finally {
      setBulkDeleting(false);
    }
  }

  async function doDeleteExercise() {
    if (!confirmFor) return;
    await api.deleteExercise(confirmFor.id);
    setExercises((current) =>
      current.filter((item) => item.id !== confirmFor.id),
    );
    setConfirmFor(null);
  }

  // "Veces" an exercise has been used = how many trainings included it, derived
  // straight from the already-loaded training history (no manual registration).
  const exerciseUsage = useMemo(() => {
    const usage = {};
    trainings.forEach((training) => {
      (training.items || []).forEach((item) => {
        if (!item.exercise_id) return;
        const current = usage[item.exercise_id] || { totalCount: 0, lastDate: null, lastDimensions: null };
        current.totalCount += 1;
        if (!current.lastDate || new Date(training.training_date) > new Date(current.lastDate)) {
          current.lastDate = training.training_date;
          current.lastDimensions = item.dimensions;
        }
        usage[item.exercise_id] = current;
      });
    });
    return usage;
  }, [trainings]);

  const enrichedExercises = useMemo(
    () =>
      exercises.map((ex) => ({
        ...ex,
        ...(exerciseUsage[ex.id] || { totalCount: 0, lastDate: null, lastDimensions: null }),
      })),
    [exercises, exerciseUsage],
  );

  const categories = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(exercises.map((ex) => ex.category).filter(Boolean)),
      ),
    ],
    [exercises],
  );

  const filteredExercises = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return enrichedExercises.filter((ex) => {
      const textOk =
        !search ||
        `${ex.name} ${ex.objective || ""} ${ex.category || ""}`
          .toLowerCase()
          .includes(search);
      const categoryOk =
        categoryFilter === "all" || ex.category === categoryFilter;
      const lastDate = ex.lastDate ? new Date(ex.lastDate) : null;
      const fromOk =
        !exerciseDateFrom ||
        (lastDate && lastDate >= new Date(exerciseDateFrom));
      const toOk =
        !exerciseDateTo || (lastDate && lastDate <= new Date(exerciseDateTo));
      const dateOk = (!exerciseDateFrom && !exerciseDateTo) || (fromOk && toOk);
      return textOk && categoryOk && dateOk;
    });
  }, [enrichedExercises, searchText, categoryFilter, exerciseDateFrom, exerciseDateTo]);

  useEffect(() => {
    setVisibleCount(EXERCISES_PAGE_SIZE);
  }, [searchText, categoryFilter, exerciseDateFrom, exerciseDateTo]);

  const visibleExercises = useMemo(
    () => filteredExercises.slice(0, visibleCount),
    [filteredExercises, visibleCount],
  );

  function clearExerciseFilters() {
    setSearchText("");
    setCategoryFilter("all");
    setExerciseDateFrom("");
    setExerciseDateTo("");
  }

  return (
    <div>
      {view === "hub" && (
        <TeamHub
          team={team}
          counts={{
            exercises: exercises.length,
            trainings: trainings.length,
            players: players.length,
          }}
          onBack={onBack}
          onOpenExercises={() => setView("exercises")}
          onOpenTrainings={() => setView("trainings")}
          onOpenMatches={() => setView("matches")}
          onOpenRoster={() => setView("roster")}
          onOpenBoard={() => setView("board")}
          onOpenStats={() => setView("stats")}
          onOpenCalendar={() => setView("calendar")}
          onOpenSearch={() => setShowSearch(true)}
        />
      )}

      {view === "calendar" && (
        <TeamCalendar
          teamId={team.id}
          team={team}
          onBack={() => setView("hub")}
        />
      )}

      {view === "exercises" && (
        <>
          <div className="header-top">
            <div>
              <button className="btn btn-back" onClick={() => setView("hub")}>
                <ArrowLeftIcon size={15}/> Atrás
              </button>
              <h2 style={{display:"inline-block",marginLeft:16,marginTop:0}}>Ejercicios</h2>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {exercises.length > 0 && (
                <button
                  className={selectMode ? "btn btn-icon-only active" : "btn btn-icon-only"}
                  title={selectMode ? "Salir de selección" : "Seleccionar ejercicios"}
                  onClick={toggleSelectMode}
                >
                  {selectMode ? <XIcon size={15}/> : <CheckSquareIcon size={15}/>}
                </button>
              )}
              {clipboardCount > 0 && (
                <button
                  className="btn"
                  disabled={pasting}
                  onClick={pasteClipboardExercises}
                >
                  <PasteIcon size={13}/> {pasting ? "Pegando…" : `Pegar (${clipboardCount})`}
                </button>
              )}
              <button
                className="btn"
                onClick={() => setShowExerciseFilters((s) => !s)}
              >
                Más filtros {showExerciseFilters ? <ChevronUpIcon size={13}/> : <ChevronDownIcon size={13}/>}
              </button>
              <button
                className="btn"
                onClick={() => setShowForum(true)}
              >
                Foro
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                + Nuevo ejercicio
              </button>
            </div>
          </div>

          {selectMode && (
            <div className="exercise-select-bar">
              <span>
                {selectedIds.size === 0
                  ? "Toca los ejercicios que quieras copiar o eliminar"
                  : selectedIds.size === 1
                  ? "1 ejercicio seleccionado"
                  : `${selectedIds.size} ejercicios seleccionados`}
              </span>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button
                  className="btn btn-primary"
                  disabled={selectedIds.size === 0}
                  onClick={copySelectedToClipboard}
                >
                  <CopyIcon size={13}/> Copiar
                </button>
                <button
                  className="btn btn-danger"
                  disabled={selectedIds.size === 0}
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )}

          <div className="exercise-search-row">
            <SearchIcon size={16}/>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por nombre, objetivo o categoría"
            />
          </div>

          {showExerciseFilters && (
            <div className="filters-panel compact">
              <div className="filters-grid exercise-filters-grid">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "Todas las categorías" : category}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={exerciseDateFrom}
                  onChange={(e) => setExerciseDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  value={exerciseDateTo}
                  onChange={(e) => setExerciseDateTo(e.target.value)}
                />
                <button
                  className="btn btn-cancel"
                  style={{ marginTop: 0 }}
                  onClick={clearExerciseFilters}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {exercises.length > 0 && (
            <div className="quick-stats-row">
              <span>
                {visibleExercises.length < filteredExercises.length
                  ? `${visibleExercises.length} de ${filteredExercises.length} ejercicios`
                  : `${filteredExercises.length} ejercicios visibles`}
              </span>
            </div>
          )}

          {exercisesLoading ? (
            <div className="empty-state">
              <LoaderIcon size={48} color="#fff" className="spin" style={{marginBottom:16}}/>
              <p style={{color:'#fff', fontSize:18, fontWeight:600, margin:0}}>Cargando ejercicios…</p>
            </div>
          ) : exercises.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><DumbbellIcon size={72}/></div>
              <h3>Sin ejercicios aún</h3>
              <p>
                Crea tu primer ejercicio para comenzar a registrar
                entrenamientos
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setCreating(true)}
                style={{ marginTop: "16px" }}
              >
                Crear primer ejercicio
              </button>
            </div>
          ) : (
            <>
              <div className="team-list">
                {visibleExercises.map((e) => (
                  <ExerciseCard
                    key={e.id}
                    exercise={e}
                    onDelete={() => onDeleteExercise(e)}
                    onOpenDetail={() => setDetailFor(e)}
                    onEdit={() => setEditingExercise(e)}
                    selectable={selectMode}
                    selected={selectedIds.has(e.id)}
                    onToggleSelect={() => toggleExerciseSelected(e.id)}
                  />
                ))}
              </div>
              {filteredExercises.length > visibleExercises.length && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
                  <button
                    className="btn"
                    onClick={() => setVisibleCount((v) => v + EXERCISES_PAGE_SIZE)}
                  >
                    Mostrar más ({filteredExercises.length - visibleExercises.length} restantes)
                  </button>
                </div>
              )}
            </>
          )}

          {exercises.length > 0 && filteredExercises.length === 0 && (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <h3>No hay ejercicios con esos filtros</h3>
              <p>Prueba a limpiar filtros o ajustar la búsqueda.</p>
            </div>
          )}
        </>
      )}

      {view === "board" && (
        <TacticalBoard teamId={team.id} onClose={() => setView("hub")} />
      )}

      {view === "roster" && (
        <PlayerManagement teamId={team.id} onClose={() => setView("hub")} initialPlayerId={searchPlayerId} />
      )}

      {view === "matches" && (
        selectedMatch ? (
          <MatchTracker
            match={selectedMatch}
            teamId={team.id}
            teamName={team.name}
            team={team}
            players={players}
            onClose={() => setSelectedMatch(null)}
          />
        ) : (
          <MatchManagement
            teamId={team.id}
            team={team}
            players={players}
            onSelectMatch={(match) => setSelectedMatch(match)}
            onClose={() => setView("hub")}
          />
        )
      )}

      {view === "stats" && (
        <TeamStatsView
          teamId={team.id}
          teamName={team.name}
          exercises={enrichedExercises}
          trainings={trainings}
          onClose={() => setView("hub")}
        />
      )}

      {view === "trainings" && (
        <TrainingsPage
          trainings={trainings}
          players={players}
          onBack={() => setView("hub")}
          onNewTraining={() => setCreatingTraining(true)}
          onExportTraining={exportSingleTraining}
          onEditTraining={(training) => setEditingTraining(training)}
          onDeleteTraining={(training) => setConfirmDeleteTraining(training)}
        />
      )}

      {creating && (
        <CreateExerciseModal
          onCreate={onCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editingExercise && (
        <CreateExerciseModal
          initial={editingExercise}
          onSave={onSaveEdit}
          onCancel={() => setEditingExercise(null)}
        />
      )}
      {creatingTraining && (
        <TrainingPlannerModal
          exercises={exercises}
          players={players}
          onSave={onCreateTraining}
          onCancel={() => setCreatingTraining(false)}
        />
      )}
      {editingTraining && (
        <TrainingPlannerModal
          exercises={exercises}
          players={players}
          initial={editingTraining}
          onSave={onEditTraining}
          onCancel={() => setEditingTraining(null)}
        />
      )}
      {confirmDeleteTraining && (
        <ConfirmModal
          title="Borrar entrenamiento"
          message={`Borrar el entrenamiento del ${new Date(confirmDeleteTraining.training_date).toLocaleDateString("es-ES")}? Se eliminarán también todos sus ejercicios.`}
          onConfirm={onConfirmDeleteTraining}
          onCancel={() => setConfirmDeleteTraining(null)}
        />
      )}
      {confirmFor && (
        <ConfirmModal
          title={`Eliminar ${confirmFor.name}`}
          message={`¿Eliminar el ejercicio "${confirmFor.name}"?`}
          onConfirm={doDeleteExercise}
          onCancel={() => setConfirmFor(null)}
        />
      )}
      {confirmBulkDelete && (
        <ConfirmModal
          title={selectedIds.size === 1 ? "Eliminar ejercicio" : `Eliminar ${selectedIds.size} ejercicios`}
          message={
            selectedIds.size === 1
              ? "¿Eliminar el ejercicio seleccionado?"
              : `¿Eliminar los ${selectedIds.size} ejercicios seleccionados?`
          }
          onConfirm={deleteSelectedExercises}
          onCancel={() => !bulkDeleting && setConfirmBulkDelete(false)}
        />
      )}
      {detailFor && (
        <ExerciseDetailModal
          exercise={detailFor}
          trainings={trainings}
          onClose={() => setDetailFor(null)}
          onEdit={() => {
            setDetailFor(null);
            setEditingExercise(detailFor);
          }}
          onToggleVisibility={() => onToggleExerciseVisibility(detailFor)}
        />
      )}
      {showForum && (
        <ExerciseForumModal onClose={() => setShowForum(false)} />
      )}
      {showSearch && (
        <GlobalSearchModal
          players={players}
          exercises={exercises}
          trainings={trainings}
          onClose={() => setShowSearch(false)}
          onSelectPlayer={handleSelectPlayerFromSearch}
          onSelectExercise={handleSelectExerciseFromSearch}
          onSelectTraining={handleSelectTrainingFromSearch}
        />
      )}
    </div>
  );
}
