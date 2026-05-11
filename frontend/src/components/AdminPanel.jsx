import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/axios';

const emptyDocumentForm = {
  titulo: '',
  autores: '',
  tutor: '',
  tipo_documento: 'TEG',
  periodo_academico: '',
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
const ITEMS_PER_PAGE = 10;

const AdminPanel = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [documents, setDocuments] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyDocumentForm);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [saving, setSaving] = useState(false);
  const [controlKey, setControlKey] = useState('');
  const [isControlKeyModalOpen, setIsControlKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [processingControlKey, setProcessingControlKey] = useState(false);

  useEffect(() => {
    loadDocuments();
    loadPeriodos();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterType, filterPeriod]);

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
      // No cerramos el modal en caso de error para que el usuario pueda intentar de nuevo
    } finally {
      setProcessingControlKey(false);
    }
  };

  const loadDocuments = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/documents', {
        params: {
          limit: 1000,
        },
      });
      setDocuments(response.data || []);
    } catch (err) {
      console.error('loadDocuments error', err);
      setError('No se pudieron cargar los documentos.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };


  const loadPeriodos = async () => {
    try {
      const response = await api.get('/documents/periodos');
      setPeriodos(response.data?.periodos || []);
    } catch (err) {
      console.error('loadPeriodos error', err);
    }
  };

  const filteredDocuments = useMemo(() => {
    const lowerText = searchText.toLowerCase().trim();
    return documents.filter((doc) => {
      const title = (doc.titulo || '').toLowerCase();
      const authors = (doc.autores || []).join(', ').toLowerCase();
      const matchesText = !lowerText || title.includes(lowerText) || authors.includes(lowerText);
      const matchesType = !filterType || doc.tipo_documento === filterType;
      const matchesPeriod = !filterPeriod || doc.periodo_academico === filterPeriod;
      return matchesText && matchesType && matchesPeriod;
    });
  }, [documents, filterPeriod, filterType, searchText]);

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
      loadDocuments();
    } catch (err) {
      console.error('add document error', err);
      setError('No se pudo agregar el documento.');
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
      loadDocuments();
    } catch (err) {
      console.error('edit document error', err);
      setError('No se pudo actualizar el documento.');
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
      loadDocuments();
    } catch (err) {
      console.error('delete document error', err);
      setError('No se pudo eliminar el documento.');
    } finally {
      setLoading(false);
    }
  };





  const totalDocumentPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);



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

          {error && (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          )}

          <section className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar documentos"
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos los tipos</option>
                  {DOCUMENT_TYPES.filter((type) => type).map((type) => (
                    <option key={type} value={type} className="bg-dark-bg text-text-main">
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos los periodos</option>
                  {periodos.map((periodo) => (
                    <option key={periodo} value={periodo} className="bg-dark-bg text-text-main">
                      {periodo}
                    </option>
                  ))}
                </select>
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
                      <th className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-text-main/70">
                          Cargando documentos...
                        </td>
                      </tr>
                    ) : filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-text-main/70">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
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

            <form onSubmit={isEditModalOpen ? handleEditClick : handleAddClick} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
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

              <div className="grid gap-4 lg:grid-cols-3">
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
                  <select
                    value={formState.tipo_documento}
                    onChange={(e) => handleFormChange('tipo_documento', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="TEG">TEG</option>
                    <option value="INF PASANTIA">INF PASANTIA</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Periodo académico</span>
                  <input
                    value={formState.periodo_academico}
                    onChange={(e) => handleFormChange('periodo_academico', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-text-main">
                <span>Resumen</span>
                <textarea
                  value={formState.resumen}
                  onChange={(e) => handleFormChange('resumen', e.target.value)}
                  className="min-h-30 w-full resize-none rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                />
              </label>

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

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : isEditModalOpen ? 'Guardar cambios' : 'Crear documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {isControlKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text-main">Verificación de Seguridad</h2>
              <p className="text-text-main/70 text-sm">
                Ingresa tu llave de control para confirmar esta acción.
              </p>
            </div>

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

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
                  type="submit"
                  disabled={processingControlKey}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingControlKey ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
