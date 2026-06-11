import React, { useEffect, useMemo, useState, useRef } from 'react';
import api from '../utils/axios';
import { useToast } from '../contexts/ToastContext';

const emptyDocumentForm = {
  titulo: '',
  autores: '',
  tutor: '',
  tipo_documento: 'TEG',
  periodo_academico: '',
  carrera: '',
  resumen: '',
  file: null,
};

const parseErrorDetail = (err, defaultMsg) => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = d.loc && d.loc.length > 0 ? d.loc[d.loc.length - 1] : 'Un campo';
      
      if (d.type === 'value_error.email' || (d.msg && d.msg.toLowerCase().includes('email'))) {
        return 'Por favor, ingresa un correo electrónico válido.';
      }
      if (d.type === 'value_error.missing' || d.type === 'missing') {
        return `El campo "${field}" es obligatorio.`;
      }
      if (d.type === 'string_too_short') {
        return `El campo "${field}" es demasiado corto.`;
      }
      
      return `Revisa el campo "${field}", parece tener un formato incorrecto.`;
    }).join(' | ');
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return defaultMsg;
};

const DOCUMENT_TYPES = ['', 'TEG', 'INF PASANTIA'];
const SELECT_CLASS = "w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 pr-12 text-text-main outline-none transition duration-200 ease-in-out hover:border-primary/40 hover:ring-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/30 hover:no-underline appearance-none";
const CAREER_OPTIONS = [
  'INGENIERÍA DE MANTENIMIENTO MENCIÓN INDUSTRIAL',
  'INGENIERÍA DE SISTEMAS',
  'INGENIERÍA DEL AMBIENTE Y DE LOS RECURSOS NATURALES',
  'INGENIERÍA EN INFORMÁTICA',
];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => String(CURRENT_YEAR - i));
const ACADEMIC_TERMS = ['I', 'II'];
const ITEMS_PER_PAGE = 10;

const AdminPanel = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterCareer, setFilterCareer] = useState('');
  const [carreras, setCarreras] = useState([]);

  const sortByPeriodoAcademic = (list) => {
    const termOrder = { I: 1, II: 2 };
    return [...list].sort((a, b) => {
      const [termA = '', yearA = '0'] = (a?.periodo_academico || '').split('-');
      const [termB = '', yearB = '0'] = (b?.periodo_academico || '').split('-');
      const yearDiff = Number(yearB) - Number(yearA);
      if (yearDiff !== 0) return yearDiff;
      return (termOrder[termB] || 0) - (termOrder[termA] || 0);
    });
  };

  const sortPeriodos = (list) => {
    const termOrder = { I: 1, II: 2 };
    return [...list].sort((a, b) => {
      const [termA = '', yearA = '0'] = (a || '').split('-');
      const [termB = '', yearB = '0'] = (b || '').split('-');
      const yearDiff = Number(yearB) - Number(yearA);
      if (yearDiff !== 0) return yearDiff;
      return (termOrder[termB] || 0) - (termOrder[termA] || 0);
    });
  };

  const normalizeSearchText = (text) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyDocumentForm);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [saving, setSaving] = useState(false);
  const [controlKey, setControlKey] = useState('');
  const [isControlKeyModalOpen, setIsControlKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [processingControlKey, setProcessingControlKey] = useState(false);
  const { addToast } = useToast();
  const [showYearMenu, setShowYearMenu] = useState(false);
  const yearMenuRef = useRef(null);

  const splitPeriodoAcademico = (periodo) => {
    if (!periodo) return { term: '', year: '' };
    const parts = (periodo || '').split('-');
    const term = parts[0] || '';
    const year = parts[1] || '';
    return { term, year };
  };

  const updatePeriodoAcademico = (year, term) => {
    if (!year) {
      setFormState((prev) => ({ ...prev, periodo_academico: '' }));
      return;
    }
    const t = term || 'I';
    setFormState((prev) => ({
      ...prev,
      periodo_academico: `${t}-${year}`,
    }));
  };

  useEffect(() => {
    loadDocuments();
    loadPeriodos();
    loadCarreras();
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(e.target)) {
        setShowYearMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterType, filterPeriod, filterCareer]);

  const requestControlKey = (action) => {
    setPendingAction(() => action);
    setIsControlKeyModalOpen(true);
  };

  const handleControlKeySubmit = async (event) => {
    event.preventDefault();
    if (processingControlKey || !pendingAction) return;

    setProcessingControlKey(true);
    try {
      await pendingAction(controlKey);
      setPendingAction(null);
      setControlKey('');
      setIsControlKeyModalOpen(false);
    } catch (error) {
      console.error('Control key action failed:', error);
      addToast('No se pudo procesar la llave de control. Verifica y vuelve a intentarlo.');
    } finally {
      setProcessingControlKey(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 1000,
      };
      if (filterType) params.tipo_documento = filterType;
      if (filterPeriod) params.periodo_academico = filterPeriod;
      if (filterCareer) params.carrera = filterCareer;

      const response = await api.get('/documents', {
        params,
      });
      setDocuments(sortByPeriodoAcademic(response.data || []));
    } catch (err) {
      console.error('loadDocuments error', err);
      addToast('No se pudieron cargar los documentos.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };


  const loadPeriodos = async () => {
    try {
      const response = await api.get('/documents/periodos');
      setPeriodos(sortPeriodos(response.data?.periodos || []));
    } catch (err) {
      console.error('loadPeriodos error', err);
    }
  };

  const loadCarreras = async () => {
    try {
      const response = await api.get('/documents/carreras');
      setCarreras(response.data?.carreras || []);
    } catch (err) {
      console.error('loadCarreras error', err);
    }
  };

  const filteredDocuments = useMemo(() => {
    const lowerText = normalizeSearchText(searchText);
    const filtered = documents.filter((doc) => {
      const title = normalizeSearchText(doc.titulo);
      const authors = normalizeSearchText((doc.autores || []).join(', '));
      const matchesText = !lowerText || title.includes(lowerText) || authors.includes(lowerText);
      const matchesType = !filterType || doc.tipo_documento === filterType;
      const matchesPeriod = !filterPeriod || doc.periodo_academico === filterPeriod;
      const matchesCareer = !filterCareer || doc.carrera === filterCareer;
      return matchesText && matchesType && matchesPeriod && matchesCareer;
    });
    return sortByPeriodoAcademic(filtered);
  }, [documents, filterPeriod, filterType, filterCareer, searchText]);

  const openAddModal = () => {
    setFormState(emptyDocumentForm);
    setSelectedDocument(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (doc) => {
    setSelectedDocument(doc);
    setFormState({
      titulo: doc.titulo || '',
      autores: (doc.autores || []).join(', '),
      tutor: doc.tutor || '',
      tipo_documento: doc.tipo_documento || 'TEG',
      periodo_academico: doc.periodo_academico || '',
      carrera: doc.carrera || '',
      resumen: doc.resumen || '',
      file: null,
    });
    setIsEditModalOpen(true);
  };

  const closeModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setFormState(emptyDocumentForm);
    setSelectedDocument(null);
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSubmit = async (event, controlKey) => {
    event.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('titulo', formState.titulo);
      formData.append('autores', formState.autores);
      formData.append('tutor', formState.tutor);
      formData.append('tipo_documento', formState.tipo_documento);
      formData.append('periodo_academico', formState.periodo_academico);
      formData.append('carrera', formState.carrera);
      formData.append('resumen', formState.resumen);
      if (formState.file) {
        formData.append('file', formState.file);
      }

      await api.post('/documents/upload', formData, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      closeModals();
      await loadDocuments();
      await loadPeriodos();
      await loadCarreras();
    } catch (err) {
      console.error('add document error', err);
      addToast(parseErrorDetail(err, 'No se pudo agregar el documento.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddClick = (event) => {

    event.preventDefault();
    requestControlKey((controlKey) => handleAddSubmit(event, controlKey));
  };

  const handleEditSubmit = async (event, controlKey) => {
    event.preventDefault();
    if (!selectedDocument) return;
    setSaving(true);
    try {
      const updatedForm = new FormData();
      updatedForm.append('titulo', formState.titulo);
      updatedForm.append('autores', formState.autores);
      updatedForm.append('tutor', formState.tutor);
      updatedForm.append('tipo_documento', formState.tipo_documento);
      updatedForm.append('periodo_academico', formState.periodo_academico);
      updatedForm.append('carrera', formState.carrera);
      updatedForm.append('resumen', formState.resumen);
      if (formState.file) {
        updatedForm.append('file', formState.file);
      }

      await api.put(`/documents/${selectedDocument.id}`, updatedForm, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      closeModals();
      await loadDocuments();
      await loadPeriodos();
      await loadCarreras();
    } catch (err) {
      console.error('edit document error', err);
      addToast(parseErrorDetail(err, 'No se pudo actualizar el documento.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (event) => {
    event.preventDefault();
    requestControlKey((controlKey) => handleEditSubmit(event, controlKey));
  };

  const handleDeleteDocument = async (doc, controlKey) => {
    setLoading(true);
    try {
      await api.delete(`/documents/${doc.id}`, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      await loadDocuments();
      await loadPeriodos();
      await loadCarreras();
    } catch (err) {
      console.error('delete document error', err);
      addToast(parseErrorDetail(err, 'No se pudo eliminar el documento.'));
    } finally {
      setLoading(false);
    }
  };





  const totalDocumentPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const selectedPeriodo = splitPeriodoAcademico(formState.periodo_academico);

  const renderPagination = (totalPages) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-4">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="rounded-2xl border border-dark-border bg-black/10 px-4 py-2 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-text-main">
          Página <span className="font-bold text-primary">{currentPage}</span> de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="rounded-2xl border border-dark-border bg-black/10 px-4 py-2 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-main">
      <div className="mx-auto flex flex-col lg:flex-row min-h-screen max-w-[1600px] gap-6 px-4 py-6 lg:px-8">
        
        {/* Sidebar / Mobile Header */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-3xl border border-dark-border bg-dark-card p-6 shadow-lg text-center lg:text-left">
              <div className="mb-6 border-b border-dark-border pb-4">
                <h2 className="text-xl font-black text-primary tracking-tight">ADMIN</h2>
                <p className="mt-1 text-xs text-text-main/50 uppercase font-bold tracking-widest">Gestión de Documentos</p>
              </div>
              
              <div className="mt-4 rounded-2xl border border-dark-border bg-black/20 p-4 text-xs space-y-3">
                <p className="font-bold text-text-main/40 uppercase tracking-widest">Resumen</p>
                <div className="flex justify-between">
                  <span className="text-text-main/60">Documentos Totales:</span>
                  <span className="font-bold text-primary">{documents.length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <section className="rounded-3xl border border-dark-border bg-dark-card p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-text-main">Documentos</h1>
                <p className="text-text-main/70">
                  Gestion y controlde documentos.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90"
                >
                  Agregar Documento
                </button>
              </div>
            </div>
          </section>


          <section className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar documentos"
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Todos los tipos</option>
                    {DOCUMENT_TYPES.filter((type) => type).map((type) => (
                      <option key={type} value={type} className="bg-dark-bg text-text-main">
                        {type}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Todos los periodos</option>
                    {periodos.map((periodo) => (
                      <option key={periodo} value={periodo} className="bg-dark-bg text-text-main">
                        {periodo}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={filterCareer}
                    onChange={(e) => setFilterCareer(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Todas las carreras</option>
                    {carreras.map((carrera) => (
                      <option key={carrera} value={carrera} className="bg-dark-bg text-text-main">
                        {carrera}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-dark-border bg-dark-card shadow-lg">
                <table className="min-w-full divide-y divide-dark-border text-left text-sm text-text-main">
                  <thead className="bg-dark-bg/70 text-text-main/80">
                    <tr>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Autores</th>
                      <th className="px-4 py-3">Tutor</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Periodo</th>
                      <th className="px-4 py-3">Carrera</th>
                      <th className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-text-main/70">
                          Cargando documentos...
                        </td>
                      </tr>
                    ) : filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-text-main/70">
                          No se encontraron documentos.
                        </td>
                      </tr>
                    ) : (
                      paginatedDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium text-text-main">{doc.titulo}</td>
                          <td className="px-4 py-3 text-text-main/80">{(doc.autores || []).join(', ')}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.tutor || '-'}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.tipo_documento || '-'}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.periodo_academico || '-'}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.carrera || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={doc.archivo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
                              >
                                Ver archivo
                              </a>
                              <button
                                type="button"
                                onClick={() => openEditModal(doc)}
                                className="rounded-2xl border border-dark-border bg-black/10 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
                              >
                                Modificar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(totalDocumentPages)}
            </section>
        </main>
      </div>

      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-2 pb-12">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-visible rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-text-main">
                  {isEditModalOpen ? 'Modificar Documento' : 'Agregar Documento'}
                </h2>
                <p className="text-text-main/70">
                  {isEditModalOpen
                    ? 'Actualiza los datos del documento.'
                    : 'Carga una nueva tesis al repositorio.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-full border border-dark-border bg-black/20 px-3 py-2 text-text-main transition hover:border-primary hover:text-primary"
              >
                X
              </button>
            </div>

            <div className="flex flex-col max-h-[70vh]">
              <div className="overflow-auto pr-2">
                <form onSubmit={isEditModalOpen ? handleEditClick : handleAddClick} className="space-y-4">
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Título</span>
                      <input
                        value={formState.titulo}
                        onChange={(e) => handleFormChange('titulo', e.target.value)}
                        className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Autores</span>
                      <input
                        value={formState.autores}
                        onChange={(e) => handleFormChange('autores', e.target.value)}
                        className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        placeholder="Autor A, Autor B"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Tutor</span>
                      <input
                        value={formState.tutor}
                        onChange={(e) => handleFormChange('tutor', e.target.value)}
                        className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Tipo de documento</span>
                      <div className="relative">
                        <select
                          value={formState.tipo_documento}
                          onChange={(e) => handleFormChange('tipo_documento', e.target.value)}
                          className={SELECT_CLASS}
                        >
                          <option value="TEG">TEG</option>
                          <option value="INF PASANTIA">INF PASANTIA</option>
                        </select>
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </label>
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Periodo académico</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <div ref={yearMenuRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setShowYearMenu((s) => !s)}
                              className={`${SELECT_CLASS} relative text-left`}
                            >
                              <span className="block pr-8">{selectedPeriodo.year || 'Selecciona año'}</span>
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </span>
                            </button>
                            {showYearMenu && (
                              <ul className="absolute left-0 top-full mt-2 z-50 max-h-64 w-full overflow-auto rounded-md border border-dark-border bg-dark-card shadow-lg">
                                {ACADEMIC_YEARS.map((year) => (
                                  <li key={year}>
                                    <button
                                      type="button"
                                      onClick={() => { updatePeriodoAcademico(year, selectedPeriodo.term); setShowYearMenu(false); }}
                                      className="w-full px-3 py-2 text-left text-text-main hover:bg-dark-bg/50"
                                    >
                                      {year}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                        <div className="relative">
                          <select
                            value={selectedPeriodo.term || ''}
                            onChange={(e) => updatePeriodoAcademico(selectedPeriodo.year, e.target.value)}
                            className={SELECT_CLASS}
                            required
                          >
                            <option value="">Selecciona periodo</option>
                            {selectedPeriodo.year && ACADEMIC_TERMS.map((term) => (
                              <option key={term} value={term}>
                                {term} - {selectedPeriodo.year}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </label>
                    <label className="space-y-2 text-sm text-text-main">
                      <span>Carrera</span>
                      <div className="relative">
                        <select
                          value={formState.carrera}
                          onChange={(e) => handleFormChange('carrera', e.target.value)}
                          className={SELECT_CLASS}
                          required
                        >
                          <option value="">Selecciona una carrera</option>
                          {CAREER_OPTIONS.map((carrera) => (
                            <option key={carrera} value={carrera}>
                              {carrera}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-main/50">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-text-main">
                    <span>Seleccionar archivo:</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleFormChange('file', e.target.files?.[0] || null)}
                      className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 file:hidden"
                      {...(!isEditModalOpen ? { required: true } : {})}
                    />
                  </label>
                </form>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const form = e.currentTarget.closest('.rounded-3xl')?.querySelector('form');
                    if (form) {
                      if (typeof form.requestSubmit === 'function') form.requestSubmit();
                      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                  }}
                  disabled={saving}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : isEditModalOpen ? 'Guardar cambios' : 'Crear documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isControlKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-2 pb-12">
          <div className="w-full max-w-md max-h-[90vh] overflow-visible rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text-main">Verificación de Seguridad</h2>
              <p className="text-text-main/70 text-sm">
                Ingresa tu llave de control para confirmar esta acción.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="overflow-auto pr-2">
                <form onSubmit={handleControlKeySubmit} className="space-y-4">
                  <label className="space-y-2 text-sm text-text-main">
                    <span>Llave de Control</span>
                    <input
                      type="password"
                      value={controlKey}
                      onChange={(e) => setControlKey(e.target.value)}
                      disabled={processingControlKey}
                      className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Ingresa tu PIN de seguridad"
                      required
                    />
                  </label>
                </form>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!processingControlKey) {
                      setIsControlKeyModalOpen(false);
                      setControlKey('');
                      setPendingAction(null);
                      setProcessingControlKey(false);
                    }
                  }}
                  disabled={processingControlKey}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const form = e.currentTarget.closest('.rounded-3xl')?.querySelector('form');
                    if (form) {
                      if (typeof form.requestSubmit === 'function') form.requestSubmit();
                      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                  }}
                  disabled={processingControlKey}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingControlKey ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
