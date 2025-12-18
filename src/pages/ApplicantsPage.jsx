import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, setDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { calculateExamScore, calculateAIRiskLevel } from '../utils/scoreCalculator';
import { db, auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import AIScoreBadge from '../components/AIScoreBadge';
import { Eye, Filter, Plus, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

const ApplicantsPage = () => {
  const [applicants, setApplicants] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ dni: '', name: '', code: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', status: 'enabled', disabledReason: '', interview: 'no', interviewComment: '' });
  const [expandedComments, setExpandedComments] = useState(new Set());
  
  const disabledReasons = [
    'Baja del equipo de talento',
    'No cumple con los requisitos del equipo de IT',
    'Desistió del proceso',
    'Copió en la prueba',
    'Test QA'
  ];
  const navigate = useNavigate();

  useEffect(() => {
    fetchTestTypes();
    fetchApplicants();
  }, []);

  const fetchTestTypes = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'test_types'));
      const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTestTypes(types);
    } catch (error) {
      logger.error('Error fetching test types:', error);
    }
  };

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      // Obtener postulantes registrados
      const postulanteRef = collection(db, 'postulante');
      const postulanteSnapshot = await getDocs(postulanteRef);
      
      // Obtener respuestas de pruebas
      const responsesRef = collection(db, 'responses');
      const responsesSnapshot = await getDocs(responsesRef);
      
      // Crear mapa de respuestas por DNI
      const responsesMap = new Map();
      responsesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.dni) {
          responsesMap.set(data.dni, {
            id: doc.id,
            submittedAt: data.submittedAt,
            aiAnalysis: data.aiAnalysis,
            answers: data.answers || [],
            hasTest: true
          });
        }
      });
      
      // Obtener respuestas modelo para cálculos
      const answersQuery = query(
        collection(db, 'respuestas'),
        where('testType', '==', 'LT_QR'),
        where('active', '==', true)
      );
      const answersSnapshot = await getDocs(answersQuery);
      const modelAnswers = answersSnapshot.docs.map(doc => doc.data());
      
      // Combinar datos
      const applicantsData = await Promise.all(postulanteSnapshot.docs.map(async doc => {
        const postulanteData = doc.data();
        const dni = postulanteData.dni;
        const responseData = responsesMap.get(dni);
        
        return {
          id: responseData?.id || doc.id,
          postulanteDocId: doc.id, // ID real del documento en postulante
          dni: dni,
          name: postulanteData.name || 'Sin nombre',
          email: dni || 'Sin DNI',
          appliedAt: responseData?.submittedAt || postulanteData.createdAt,
          status: responseData ? 
            (responseData.aiAnalysis?.finalAssessment?.riskLevel || 'completed') : 
            'not_tested',
          overallAIScore: responseData?.aiAnalysis?.serverResults?.length > 0 
            ? Math.round(responseData.aiAnalysis.serverResults.reduce((sum, result) => sum + (result.score || 0), 0) / responseData.aiAnalysis.serverResults.length)
            : 0,
          hasTest: !!responseData,
          totalScore: responseData ? (() => {
            console.log('📊 Calculando score para:', postulanteData.name);
            console.log('📝 ResponseData:', responseData);
            console.log('📋 ModelAnswers:', modelAnswers);
            const score = calculateExamScore(responseData, modelAnswers);
            console.log('🏆 Score calculado:', score);
            return score;
          })() : 0,
          aiRiskLevel: responseData ? calculateAIRiskLevel(responseData) : 'Bajo',
          userStatus: postulanteData.status || 'enabled',
          disabledReason: postulanteData.disabledReason || '',
          interview: postulanteData.interview || 'no',
          interviewComment: postulanteData.interviewComment || ''
        };
      }));
      
      // Ordenar por fecha de creación descendente
      applicantsData.sort((a, b) => {
        const dateA = a.appliedAt?.toDate?.() || new Date(0);
        const dateB = b.appliedAt?.toDate?.() || new Date(0);
        return dateB - dateA; // Descendente (más reciente primero)
      });
      
      setApplicants(applicantsData);
    } catch (error) {
      logger.error('Error fetching applicants:', error);
      toast.error('Error al cargar postulantes. Reintentando...');
      setTimeout(() => {
        fetchApplicants();
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApplicant = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'postulante'), {
        ...createForm,
        status: 'enabled',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.email
      });
      
      toast.success('Postulante creado exitosamente');
      setShowCreateForm(false);
      setCreateForm({ dni: '', name: '', code: '' });
      fetchApplicants();
    } catch (error) {
      logger.error('Error creating applicant:', error);
      toast.error('Error al crear postulante');
    }
  };
  
  const handleEditApplicant = (applicant) => {
    setEditingApplicant(applicant);
    setEditForm({
      name: applicant.name,
      status: applicant.userStatus || 'enabled',
      disabledReason: applicant.disabledReason || '',
      interview: applicant.interview || 'no',
      interviewComment: applicant.interviewComment || ''
    });
    setShowEditModal(true);
  };
  
  const handleUpdateApplicant = async (e) => {
    e.preventDefault();
    
    console.log('🔄 Iniciando actualización de postulante');
    console.log('📝 Datos del formulario:', editForm);
    console.log('👤 Postulante a editar:', editingApplicant);
    
    if (editForm.status === 'disabled' && !editForm.disabledReason) {
      console.log('❌ Error: Falta motivo para deshabilitar');
      toast.error('Debe seleccionar un motivo para deshabilitar');
      return;
    }
    
    try {
      const updateData = {
        name: editForm.name,
        status: editForm.status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.email
      };
      
      if (editForm.status === 'disabled') {
        updateData.disabledReason = editForm.disabledReason;
      } else {
        updateData.disabledReason = null;
      }
      
      updateData.interview = editForm.interview;
      if (editForm.interview === 'yes') {
        updateData.interviewComment = editForm.interviewComment;
      } else {
        updateData.interviewComment = null;
      }
      
      console.log('📤 Datos a actualizar:', updateData);
      const docId = editingApplicant.postulanteDocId || editingApplicant.id;
      console.log('🎯 Documento a actualizar:', `postulante/${docId}`);
      
      await updateDoc(doc(db, 'postulante', docId), updateData);
      
      console.log('✅ Postulante actualizado exitosamente');
      toast.success('Postulante actualizado exitosamente');
      setShowEditModal(false);
      setEditingApplicant(null);
      fetchApplicants();
    } catch (error) {
      console.error('❌ ERROR COMPLETO AL ACTUALIZAR:', error);
      console.error('❌ Código:', error.code);
      console.error('❌ Mensaje:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Detalles adicionales:', {
        errorName: error.name,
        errorToString: error.toString(),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      logger.error('Error updating applicant:', error);
      toast.error(`Error: ${error.code || error.message}`);
    }
  };

  const filteredApplicants = applicants.filter(applicant => {
    if (filter === 'all') return true;
    if (filter === 'not_tested') return !applicant.hasTest;
    if (filter === 'completed') return applicant.hasTest;
    if (filter === 'low') return applicant.status === 'low';
    if (filter === 'high') return applicant.status === 'high' || applicant.status === 'critical';
    if (filter === 'high-ai') return applicant.overallAIScore > 60;
    return true;
  });

  const getStatusBadge = (status, hasTest) => {
    if (!hasTest) {
      return <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>Sin Prueba</span>;
    }
    
    const statusMap = {
      low: { class: 'badge badge-green', label: 'Bajo Riesgo' },
      moderate: { class: 'badge badge-yellow', label: 'Riesgo Moderado' },
      high: { class: 'badge badge-red', label: 'Alto Riesgo' },
      critical: { class: 'badge badge-red', label: 'Crítico' },
      completed: { class: 'badge badge-green', label: 'Completado' }
    };
    
    const statusInfo = statusMap[status] || { class: 'badge badge-yellow', label: 'Pendiente' };
    return <span className={statusInfo.class}>{statusInfo.label}</span>;
  };
  
  const getUserStatusBadge = (userStatus, disabledReason) => {
    if (!userStatus || userStatus === 'enabled') {
      return <span className="badge badge-green">Habilitado</span>;
    }
    
    if (userStatus === 'disabled') {
      return (
        <div>
          <span className="badge badge-red">Deshabilitado</span>
          {disabledReason && (
            <div className="text-xs text-red-600 mt-1">{disabledReason}</div>
          )}
        </div>
      );
    }
    
    return <span className="badge">Desconocido</span>;
  };
  


  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '16rem' }}>
        <div className="animate-spin rounded-full" style={{ 
          width: '2rem', 
          height: '2rem', 
          border: '2px solid #e5e7eb', 
          borderTop: '2px solid #009EE4' 
        }}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Postulantes</h1>
        <p className="text-gray-600">Gestión y análisis de postulantes</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="form-input"
              style={{ width: 'auto' }}
            >
              <option value="all">Todos</option>
              <option value="not_tested">Sin Prueba</option>
              <option value="completed">Con Prueba</option>
              <option value="low">Bajo Riesgo</option>
              <option value="high">Alto Riesgo</option>
              <option value="high-ai">Score IA > 60%</option>
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredApplicants.length} de {applicants.length} postulantes
          </span>
        </div>
        
        <button
          onClick={() => {
            setShowCreateForm(true);
            setTimeout(() => {
              document.getElementById('create-form')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Nuevo Postulante</span>
        </button>
      </div>

      <div className="bg-white shadow rounded-lg" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--gray-50)' }}>
            <tr>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Postulante
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fecha
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estado Prueba
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estado Usuario
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resultado Examen
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Entrevista
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'white' }}>
            {filteredApplicants.map((applicant) => {
              const isDisabled = applicant.userStatus === 'disabled';
              return (
                <tr 
                  key={applicant.id} 
                  style={{ 
                    borderTop: '1px solid var(--gray-200)',
                    backgroundColor: isDisabled ? '#fef2f2' : 'white'
                  }}
                >
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {applicant.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {applicant.email}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-sm text-gray-500">
                  {applicant.appliedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  {getStatusBadge(applicant.status, applicant.hasTest)}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  {getUserStatusBadge(applicant.userStatus, applicant.disabledReason)}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  {applicant.hasTest ? (
                    <span className="text-sm font-semibold">{applicant.totalScore || 0}/20</span>
                  ) : (
                    <span className="text-gray-400 text-sm">N/A</span>
                  )}
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  {applicant.interview === 'yes' ? (
                    <div>
                      <span className="badge badge-green text-xs">Sí</span>
                      {applicant.interviewComment && (() => {
                        const isExpanded = expandedComments.has(applicant.id);
                        const lines = applicant.interviewComment.split('\n');
                        const shouldTruncate = lines.length > 2;
                        const displayText = isExpanded ? applicant.interviewComment : lines.slice(0, 2).join('\n');
                        
                        return (
                          <div className="mt-1" style={{ maxWidth: '200px' }}>
                            <div className="text-xs text-gray-600" style={{ wordWrap: 'break-word', whiteSpace: 'pre-line' }}>
                              {displayText}
                            </div>
                            {shouldTruncate && (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedComments);
                                  if (isExpanded) {
                                    newExpanded.delete(applicant.id);
                                  } else {
                                    newExpanded.add(applicant.id);
                                  }
                                  setExpandedComments(newExpanded);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                {isExpanded ? '- Menos' : '+ Más'}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">No</span>
                  )}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        handleEditApplicant(applicant);
                        setTimeout(() => {
                          document.getElementById('edit-modal')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="flex items-center space-x-1"
                      style={{ color: 'var(--primary-blue)', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <Edit size={16} />
                      <span>Editar</span>
                    </button>
                    {applicant.hasTest && (
                      <button
                        onClick={() => navigate(`/applicants/${applicant.id}`)}
                        className="flex items-center space-x-1"
                        style={{ color: 'var(--primary-blue)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <Eye size={16} />
                        <span>Ver Detalle</span>
                      </button>
                    )}
                  </div>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredApplicants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron postulantes</p>
          </div>
        )}
      </div>

      {/* Formulario para crear postulante */}
      {showCreateForm && (
        <div id="create-form" className="mt-8 card">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Nuevo Postulante</h3>
            
            <form onSubmit={handleCreateApplicant} className="space-y-4">
              <div>
                <label className="form-label">DNI</label>
                <input
                  type="text"
                  required
                  value={createForm.dni}
                  onChange={(e) => setCreateForm({...createForm, dni: e.target.value})}
                  className="form-input"
                  placeholder="Ej: 46310482"
                />
              </div>
              
              <div>
                <label className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  className="form-input"
                  placeholder="Ej: Antonio Mendoza"
                />
              </div>
              
              <div>
                <label className="form-label">Tipo de Prueba</label>
                <select
                  required
                  value={createForm.code}
                  onChange={(e) => setCreateForm({...createForm, code: e.target.value})}
                  className="form-input"
                >
                  <option value="">Seleccionar tipo de prueba</option>
                  {testTypes.map(type => (
                    <option key={type.code} value={type.code}>
                      {type.name} ({type.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Crear Postulante
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm({ dni: '', name: '', code: '' });
                  }}
                  className="btn flex-1"
                  style={{ backgroundColor: '#6b7280', color: 'white' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de edición */}
      {showEditModal && editingApplicant && (
        <div id="edit-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Editar Postulante</h3>
            
            <form onSubmit={handleUpdateApplicant} className="space-y-4">
              <div>
                <label className="form-label">DNI (No editable)</label>
                <input
                  type="text"
                  value={editingApplicant.dni}
                  disabled
                  className="form-input bg-gray-100 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="form-input"
                />
              </div>
              
              <div>
                <label className="form-label">Estado</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value, disabledReason: e.target.value === 'enabled' ? '' : editForm.disabledReason})}
                  className="form-input"
                >
                  <option value="enabled">Habilitado</option>
                  <option value="disabled">Deshabilitado</option>
                </select>
              </div>
              
              {editForm.status === 'disabled' && (
                <div>
                  <label className="form-label">Motivo *</label>
                  <select
                    required
                    value={editForm.disabledReason}
                    onChange={(e) => setEditForm({...editForm, disabledReason: e.target.value})}
                    className="form-input"
                  >
                    <option value="">Seleccionar motivo</option>
                    {disabledReasons.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="form-label">Entrevista</label>
                <select
                  value={editForm.interview}
                  onChange={(e) => setEditForm({...editForm, interview: e.target.value, interviewComment: e.target.value === 'no' ? '' : editForm.interviewComment})}
                  className="form-input"
                >
                  <option value="no">No</option>
                  <option value="yes">Sí</option>
                </select>
              </div>
              
              {editForm.interview === 'yes' && (
                <div>
                  <label className="form-label">Comentario de Entrevista *</label>
                  <textarea
                    required
                    value={editForm.interviewComment}
                    onChange={(e) => setEditForm({...editForm, interviewComment: e.target.value})}
                    className="form-input"
                    maxLength={500}
                    rows={3}
                    placeholder="Comentarios sobre la entrevista (máximo 500 caracteres)"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editForm.interviewComment.length}/500 caracteres
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Actualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingApplicant(null);
                  }}
                  className="btn flex-1"
                  style={{ backgroundColor: '#6b7280', color: 'white' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantsPage;