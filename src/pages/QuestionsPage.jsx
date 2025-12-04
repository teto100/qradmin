import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Plus, Edit, Trash2, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const QuestionsPage = () => {
  const [testTypes, setTestTypes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTestTypeForm, setShowTestTypeForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingTestType, setEditingTestType] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Estados para formularios
  const [testTypeForm, setTestTypeForm] = useState({
    name: '',
    code: '',
    description: '',
    questionCount: 7,
    timeLimit: 1800
  });

  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    order: 1,
    category: 'technical',
    expectedAnswerLength: 200
  });

  useEffect(() => {
    fetchTestTypes();
  }, []);

  useEffect(() => {
    if (selectedTestType) {
      fetchQuestions(selectedTestType);
    }
  }, [selectedTestType]);

  const fetchTestTypes = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'test_types'));
      const types = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestTypes(types);
      if (types.length > 0 && !selectedTestType) {
        setSelectedTestType(types[0].code);
      }
    } catch (error) {
      console.error('Error fetching test types:', error);
      toast.error('Error al cargar tipos de prueba');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (testType) => {
    try {
      const q = query(
        collection(db, 'questions'),
        where('testType', '==', testType),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      const questionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => a.order - b.order);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Error al cargar preguntas');
    }
  };

  const handleCreateTestType = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'test_types'), {
        ...testTypeForm,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.email
      });
      
      toast.success('Tipo de prueba creado exitosamente');
      setShowTestTypeForm(false);
      setTestTypeForm({ name: '', code: '', description: '', questionCount: 7, timeLimit: 1800 });
      fetchTestTypes();
    } catch (error) {
      console.error('Error creating test type:', error);
      toast.error('Error al crear tipo de prueba');
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'questions'), {
        ...questionForm,
        testType: selectedTestType,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.email
      });
      
      toast.success('Pregunta creada exitosamente');
      setShowQuestionForm(false);
      setQuestionForm({ questionText: '', order: 1, category: 'technical', expectedAnswerLength: 200 });
      fetchQuestions(selectedTestType);
    } catch (error) {
      console.error('Error creating question:', error);
      toast.error('Error al crear pregunta');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (window.confirm('¿Estás seguro de eliminar esta pregunta?')) {
      try {
        await updateDoc(doc(db, 'questions', questionId), { active: false });
        toast.success('Pregunta eliminada');
        fetchQuestions(selectedTestType);
      } catch (error) {
        console.error('Error deleting question:', error);
        toast.error('Error al eliminar pregunta');
      }
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Preguntas</h1>
        <p className="text-gray-600">Administra tipos de pruebas y sus preguntas</p>
      </div>

      {/* Header con controles */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <select
            value={selectedTestType}
            onChange={(e) => setSelectedTestType(e.target.value)}
            className="form-input"
          >
            <option value="">Seleccionar tipo de prueba</option>
            {testTypes.map(type => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setShowTestTypeForm(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Settings size={16} />
            <span>Nuevo Tipo</span>
          </button>
        </div>

        {selectedTestType && (
          <button
            onClick={() => {
              setQuestionForm({
                questionText: '',
                order: questions.length + 1,
                category: 'technical',
                expectedAnswerLength: 200
              });
              setShowQuestionForm(true);
            }}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Nueva Pregunta</span>
          </button>
        )}
      </div>

      {/* Información del tipo de prueba seleccionado */}
      {selectedTestType && (
        <div className="card mb-6">
          {(() => {
            const currentType = testTypes.find(t => t.code === selectedTestType);
            return currentType ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{currentType.name}</h2>
                <p className="text-gray-600 mb-4">{currentType.description}</p>
                <div className="flex space-x-6 text-sm text-gray-500">
                  <span>Preguntas: {currentType.questionCount}</span>
                  <span>Tiempo límite: {Math.floor(currentType.timeLimit / 60)} minutos</span>
                  <span>Preguntas creadas: {questions.length}</span>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Lista de preguntas */}
      {selectedTestType && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Preguntas ({questions.length})
          </h2>
          
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay preguntas para este tipo de prueba</p>
              <button
                onClick={() => {
                  setQuestionForm({
                    questionText: '',
                    order: 1,
                    category: 'technical',
                    expectedAnswerLength: 200
                  });
                  setShowQuestionForm(true);
                }}
                className="btn btn-primary mt-4"
              >
                Crear primera pregunta
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          Pregunta {question.order}
                        </span>
                        <span className="badge badge-green text-xs">
                          {question.category}
                        </span>
                      </div>
                      <p className="text-gray-900 mb-2">{question.questionText}</p>
                      <p className="text-xs text-gray-500">
                        Respuesta esperada: ~{question.expectedAnswerLength} palabras
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setEditingQuestion(question);
                          setQuestionForm({
                            questionText: question.questionText,
                            order: question.order,
                            category: question.category,
                            expectedAnswerLength: question.expectedAnswerLength
                          });
                          setShowQuestionForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal para crear tipo de prueba */}
      {showTestTypeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingTestType ? 'Editar' : 'Nuevo'} Tipo de Prueba
            </h3>
            
            <form onSubmit={handleCreateTestType} className="space-y-4">
              <div>
                <label className="form-label">Nombre</label>
                <input
                  type="text"
                  required
                  value={testTypeForm.name}
                  onChange={(e) => setTestTypeForm({...testTypeForm, name: e.target.value})}
                  className="form-input"
                  placeholder="Ej: Prueba para LT QR"
                />
              </div>
              
              <div>
                <label className="form-label">Código</label>
                <input
                  type="text"
                  required
                  value={testTypeForm.code}
                  onChange={(e) => setTestTypeForm({...testTypeForm, code: e.target.value.toUpperCase()})}
                  className="form-input"
                  placeholder="Ej: LT_QR"
                />
              </div>
              
              <div>
                <label className="form-label">Descripción</label>
                <textarea
                  value={testTypeForm.description}
                  onChange={(e) => setTestTypeForm({...testTypeForm, description: e.target.value})}
                  className="form-input"
                  rows="3"
                  placeholder="Descripción de la prueba"
                />
              </div>
              
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="form-label">Cantidad de preguntas</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={testTypeForm.questionCount}
                    onChange={(e) => setTestTypeForm({...testTypeForm, questionCount: parseInt(e.target.value)})}
                    className="form-input"
                  />
                </div>
                
                <div className="flex-1">
                  <label className="form-label">Tiempo límite (minutos)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={Math.floor(testTypeForm.timeLimit / 60)}
                    onChange={(e) => setTestTypeForm({...testTypeForm, timeLimit: parseInt(e.target.value) * 60})}
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingTestType ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTestTypeForm(false);
                    setEditingTestType(null);
                    setTestTypeForm({ name: '', code: '', description: '', questionCount: 7, timeLimit: 1800 });
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

      {/* Modal para crear pregunta */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">
              {editingQuestion ? 'Editar' : 'Nueva'} Pregunta
            </h3>
            
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="form-label">Pregunta</label>
                <textarea
                  required
                  value={questionForm.questionText}
                  onChange={(e) => setQuestionForm({...questionForm, questionText: e.target.value})}
                  className="form-input"
                  rows="4"
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>
              
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="form-label">Orden</label>
                  <input
                    type="number"
                    min="1"
                    value={questionForm.order}
                    onChange={(e) => setQuestionForm({...questionForm, order: parseInt(e.target.value)})}
                    className="form-input"
                  />
                </div>
                
                <div className="flex-1">
                  <label className="form-label">Categoría</label>
                  <select
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({...questionForm, category: e.target.value})}
                    className="form-input"
                  >
                    <option value="technical">Técnica</option>
                    <option value="behavioral">Comportamental</option>
                    <option value="situational">Situacional</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="form-label">Longitud esperada (palabras)</label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={questionForm.expectedAnswerLength}
                  onChange={(e) => setQuestionForm({...questionForm, expectedAnswerLength: parseInt(e.target.value)})}
                  className="form-input"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingQuestion ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionForm(false);
                    setEditingQuestion(null);
                    setQuestionForm({ questionText: '', order: 1, category: 'technical', expectedAnswerLength: 200 });
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

export default QuestionsPage;