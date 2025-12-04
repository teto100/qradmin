import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Plus, Edit, FileText, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const AnswersPage = () => {
  const [testTypes, setTestTypes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selectedTestType, setSelectedTestType] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const [answerForm, setAnswerForm] = useState({
    correctAnswer: '',
    keyPoints: [''],
    scoringCriteria: {
      excellent: '',
      good: '',
      fair: '',
      poor: ''
    }
  });

  useEffect(() => {
    fetchTestTypes();
  }, []);

  useEffect(() => {
    if (selectedTestType) {
      fetchQuestions(selectedTestType);
      fetchAnswers(selectedTestType);
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

  const fetchAnswers = async (testType) => {
    try {
      const q = query(
        collection(db, 'respuestas'),
        where('testType', '==', testType),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      const answersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnswers(answersData);
    } catch (error) {
      console.error('Error fetching answers:', error);
      toast.error('Error al cargar respuestas');
    }
  };

  const handleCreateAnswer = async (e) => {
    e.preventDefault();
    
    try {
      const answerData = {
        questionId: editingQuestion.id,
        testType: selectedTestType,
        questionOrder: editingQuestion.order,
        correctAnswer: answerForm.correctAnswer,
        keyPoints: answerForm.keyPoints.filter(point => point.trim() !== ''),
        scoringCriteria: answerForm.scoringCriteria,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.email,
        active: true
      };
      
      const existingAnswer = answers.find(a => a.questionId === editingQuestion.id);
      
      if (existingAnswer) {
        await updateDoc(doc(db, 'respuestas', existingAnswer.id), answerData);
        toast.success('Respuesta actualizada');
      } else {
        await addDoc(collection(db, 'respuestas'), answerData);
        toast.success('Respuesta creada');
      }
      
      setShowAnswerForm(false);
      setEditingQuestion(null);
      resetForm();
      fetchAnswers(selectedTestType);
    } catch (error) {
      console.error('Error saving answer:', error);
      toast.error('Error al guardar respuesta');
    }
  };

  const resetForm = () => {
    setAnswerForm({
      correctAnswer: '',
      keyPoints: [''],
      scoringCriteria: { excellent: '', good: '', fair: '', poor: '' }
    });
  };

  const addKeyPoint = () => {
    setAnswerForm({
      ...answerForm,
      keyPoints: [...answerForm.keyPoints, '']
    });
  };

  const updateKeyPoint = (index, value) => {
    const newKeyPoints = [...answerForm.keyPoints];
    newKeyPoints[index] = value;
    setAnswerForm({ ...answerForm, keyPoints: newKeyPoints });
  };

  const removeKeyPoint = (index) => {
    const newKeyPoints = answerForm.keyPoints.filter((_, i) => i !== index);
    setAnswerForm({ ...answerForm, keyPoints: newKeyPoints });
  };

  const openAnswerForm = (question) => {
    setEditingQuestion(question);
    const existingAnswer = answers.find(a => a.questionId === question.id);
    
    if (existingAnswer) {
      setAnswerForm({
        correctAnswer: existingAnswer.correctAnswer,
        keyPoints: existingAnswer.keyPoints || [''],
        scoringCriteria: existingAnswer.scoringCriteria
      });
    } else {
      resetForm();
    }
    
    setShowAnswerForm(true);
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
        <h1 className="text-2xl font-bold text-gray-900">Respuestas Modelo</h1>
        <p className="text-gray-600">Gestiona las respuestas correctas para cada pregunta</p>
      </div>

      {/* Selector de tipo de prueba */}
      <div className="mb-6">
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
      </div>

      {/* Lista de preguntas con respuestas */}
      {selectedTestType && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Preguntas y Respuestas ({questions.length})
          </h2>
          
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay preguntas para este tipo de prueba</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => {
                const hasAnswer = answers.find(a => a.questionId === question.id);
                
                return (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-500">
                            Pregunta {question.order}
                          </span>
                          <span className="badge badge-green text-xs">
                            {question.category}
                          </span>
                          {hasAnswer && (
                            <span className="badge text-xs" style={{ backgroundColor: '#10b981', color: 'white' }}>
                              <Check size={12} className="mr-1" />
                              Con respuesta
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900">{question.questionText}</p>
                      </div>
                      
                      {!hasAnswer && (
                        <div className="ml-4">
                          <button
                            onClick={() => {
                              openAnswerForm(question);
                              setTimeout(() => {
                                document.getElementById('answer-form')?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            }}
                            className="btn btn-primary flex items-center space-x-2"
                          >
                            <Plus size={16} />
                            <span>Crear Respuesta</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {hasAnswer && (
                      <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm font-medium text-green-800 mb-2">
                          Respuesta modelo:
                        </p>
                        <p className="text-sm text-gray-700 mb-3">
                          {hasAnswer.correctAnswer}
                        </p>
                        {hasAnswer.keyPoints && hasAnswer.keyPoints.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-green-700 mb-1">Puntos clave:</p>
                            <ul className="text-xs text-gray-600 list-disc list-inside">
                              {hasAnswer.keyPoints.map((point, idx) => (
                                <li key={idx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              openAnswerForm(question);
                              setTimeout(() => {
                                document.getElementById('answer-form')?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            }}
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            Editar respuesta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Formulario para respuesta modelo */}
      {showAnswerForm && (
        <div id="answer-form" className="mt-8 card">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Respuesta Modelo - Pregunta {editingQuestion?.order}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">{editingQuestion?.questionText}</p>
            </div>
            
            <form onSubmit={handleCreateAnswer} className="space-y-4">
              <div>
                <label className="form-label">Respuesta Correcta</label>
                <textarea
                  required
                  value={answerForm.correctAnswer}
                  onChange={(e) => setAnswerForm({...answerForm, correctAnswer: e.target.value})}
                  className="form-input"
                  rows="6"
                  placeholder="Escribe la respuesta modelo completa..."
                />
              </div>
              
              <div>
                <label className="form-label">Puntos Clave</label>
                {answerForm.keyPoints.map((point, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => updateKeyPoint(index, e.target.value)}
                      className="form-input flex-1"
                      placeholder="Punto clave que debe mencionar"
                    />
                    {answerForm.keyPoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKeyPoint(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addKeyPoint}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Agregar punto clave
                </button>
              </div>
              
              <div>
                <label className="form-label">Criterios de Evaluación</label>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-green-600">Excelente</label>
                    <input
                      type="text"
                      value={answerForm.scoringCriteria.excellent}
                      onChange={(e) => setAnswerForm({
                        ...answerForm,
                        scoringCriteria: {...answerForm.scoringCriteria, excellent: e.target.value}
                      })}
                      className="form-input"
                      placeholder="Criterio para calificación excelente"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-blue-600">Bueno</label>
                    <input
                      type="text"
                      value={answerForm.scoringCriteria.good}
                      onChange={(e) => setAnswerForm({
                        ...answerForm,
                        scoringCriteria: {...answerForm.scoringCriteria, good: e.target.value}
                      })}
                      className="form-input"
                      placeholder="Criterio para calificación buena"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-yellow-600">Regular</label>
                    <input
                      type="text"
                      value={answerForm.scoringCriteria.fair}
                      onChange={(e) => setAnswerForm({
                        ...answerForm,
                        scoringCriteria: {...answerForm.scoringCriteria, fair: e.target.value}
                      })}
                      className="form-input"
                      placeholder="Criterio para calificación regular"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-red-600">Deficiente</label>
                    <input
                      type="text"
                      value={answerForm.scoringCriteria.poor}
                      onChange={(e) => setAnswerForm({
                        ...answerForm,
                        scoringCriteria: {...answerForm.scoringCriteria, poor: e.target.value}
                      })}
                      className="form-input"
                      placeholder="Criterio para calificación deficiente"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Guardar Respuesta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAnswerForm(false);
                    setEditingQuestion(null);
                    resetForm();
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

export default AnswersPage;