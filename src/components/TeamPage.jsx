import React, { useEffect, useMemo, useState } from "react";
import ExerciseCard from "./ExerciseCard";
import { api } from "../lib/api";
import { exportTrainingToPdf } from "../lib/pdfExport";
import { exportTrainingFichaToPdf } from "../lib/pdfFicha";
import { isFichaTraining } from "../lib/trainingFicha";
import CreateExerciseModal from "./CreateExerciseModal";
import RegisterModal from "./RegisterModal";
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
import { ArrowLeftIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon, DumbbellIcon, LoaderIcon } from "./Icons";

export default function TeamPage({ team, onBack }) {
  const [view, setView] = useState("hub"); // hub | exercises | trainings | board | roster | matches | stats
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [registerFor, setRegisterFor] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [creatingTraining, setCreatingTraining] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [trainings, setTrainings] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showExerciseFilters, setShowExerciseFilters] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [exerciseDateFrom, setExerciseDateFrom] = useState("");
  const [exerciseDateTo, setExerciseDateTo] = useState("");

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
      if (exs.length === 0) return;
      setStatsLoading(true);
      loadExerciseWithRecords(exs)
        .then(enriched => setExercises(enriched))
        .catch(err => console.error('Error cargando estadísticas:', err))
        .finally(() => setStatsLoading(false));
    }).catch(() => setExercisesLoading(false));
    api.getPlayers(team.id).then(setPlayers);
    loadTrainingHistory(team.id);
  }, [team]);

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

  async function loadExerciseWithRecords(exercises) {
    if (!exercises.length) return exercises;

    // Single batch query instead of one query per exercise (avoids N+1 timeout with large datasets)
    const exerciseIds = exercises.map((ex) => ex.id);
    const allRecords = await api.getRecordsByExerciseIds(exerciseIds);

    // Group records by exercise_id (already ordered desc by occurred_at)
    const recordsByEx = {};
    allRecords.forEach((r) => {
      if (!recordsByEx[r.exercise_id]) recordsByEx[r.exercise_id] = [];
      recordsByEx[r.exercise_id].push(r);
    });

    return exercises.map((ex) => {
      const records = recordsByEx[ex.id] || [];
      const totalCount = records.reduce((sum, r) => sum + (r.count || 0), 0);
      const avgEff =
        records.length > 0
          ? records.reduce((sum, r) => sum + (r.effectiveness || 0), 0) / records.length
          : 0;
      const lastRecord = records[0];
      return {
        ...ex,
        totalCount,
        effectivenessAvg: avgEff,
        lastDate: lastRecord?.occurred_at,
        lastDimensions: lastRecord?.dimensions,
      };
    });
  }

  async function onSaveRecord(data) {
    await api.createRecord({ exercise_id: registerFor.id, ...data });
    const updated = await loadExerciseWithRecords(exercises);
    setExercises(updated);
    setRegisterFor(null);
  }

  async function loadTrainingHistory(teamId) {
    const basicTrainings = await api.getTrainings(teamId);
    const withItems = await Promise.all(
      basicTrainings.map(async (training) => {
        const items = await api.getTrainingItems(training.id);
        return { ...training, items };
      }),
    );
    setTrainings(withItems);
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

  async function doDeleteExercise() {
    if (!confirmFor) return;
    await api.deleteExercise(confirmFor.id);
    setExercises((current) =>
      current.filter((item) => item.id !== confirmFor.id),
    );
    if (registerFor?.id === confirmFor.id) setRegisterFor(null);
    setConfirmFor(null);
  }

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
    return exercises.filter((ex) => {
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
  }, [exercises, searchText, categoryFilter, exerciseDateFrom, exerciseDateTo]);

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
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button
                className="btn"
                onClick={() => setShowExerciseFilters((s) => !s)}
              >
                Más filtros {showExerciseFilters ? <ChevronUpIcon size={13}/> : <ChevronDownIcon size={13}/>}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                + Nuevo ejercicio
              </button>
            </div>
          </div>

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
              <span>{filteredExercises.length} ejercicios visibles</span>
              {statsLoading && (
                <span style={{color:'#888', fontSize:12}}>Cargando estadísticas…</span>
              )}
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
            <div className="team-list">
              {filteredExercises.map((e) => (
                <ExerciseCard
                  key={e.id}
                  exercise={e}
                  onAddRecord={() => setRegisterFor(e)}
                  onDelete={() => onDeleteExercise(e)}
                  onOpenDetail={() => setDetailFor(e)}
                  onEdit={() => setEditingExercise(e)}
                />
              ))}
            </div>
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
        <PlayerManagement teamId={team.id} onClose={() => setView("hub")} />
      )}

      {view === "matches" && (
        selectedMatch ? (
          <MatchTracker
            match={selectedMatch}
            teamId={team.id}
            teamName={team.name}
            players={players}
            onClose={() => setSelectedMatch(null)}
          />
        ) : (
          <MatchManagement
            teamId={team.id}
            onSelectMatch={(match) => setSelectedMatch(match)}
            onClose={() => setView("hub")}
          />
        )
      )}

      {view === "stats" && (
        <TeamStatsView
          teamId={team.id}
          teamName={team.name}
          exercises={exercises}
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
      {registerFor && (
        <RegisterModal
          exercise={registerFor}
          onSave={onSaveRecord}
          onCancel={() => setRegisterFor(null)}
        />
      )}
      {confirmFor && (
        <ConfirmModal
          title={`Eliminar ${confirmFor.name}`}
          message={`Eliminar el ejercicio "${confirmFor.name}"? Se borrarán también sus registros.`}
          onConfirm={doDeleteExercise}
          onCancel={() => setConfirmFor(null)}
        />
      )}
      {detailFor && (
        <ExerciseDetailModal
          exercise={detailFor}
          onClose={() => setDetailFor(null)}
          onEdit={() => {
            setDetailFor(null);
            setEditingExercise(detailFor);
          }}
        />
      )}
    </div>
  );
}
