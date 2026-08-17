import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from "../api/axios";
import "../assets/css/ChapterView.css";
import Signup from "./Signup";

const ChapterView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const inTextRef = useRef(null);

  const [chapter, setChapter] = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [activeSection, setActiveSection] = useState("in-text"); // "in-text" or "test-yourself"
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [inTextNextClicks, setInTextNextClicks] = useState(0);
  const [inTextAccessBlocked, setInTextAccessBlocked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReturnSection, setAuthReturnSection] = useState("in-text");

  const hasPaid = localStorage.getItem("hasPaid") === "true"; // payment status from backend

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setInTextAccessBlocked(false);
    setInTextNextClicks(0);
    setShowAuthModal(false);
    setActiveSection(authReturnSection);
  };

  // Check if user is admin
  const isAdmin = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;
      const parts = token.split('.');
      if (parts.length < 2) return false;
      const payload = JSON.parse(atob(parts[1]));
      return payload.role === 'admin';
    } catch {
      return false;
    }
  })();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const [currentInTextQuestion, setCurrentInTextQuestion] = useState(0);
  const [showInTextSolution, setShowInTextSolution] = useState(false);

  // Admin add content states
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addingMCQ, setAddingMCQ] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newAnswer, setNewAnswer] = useState(0);

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const res = await api.get(`/chapters/${id}`);
        setChapter(res.data);
        // Reset states for demo
        setCurrentInTextQuestion(0);
        setShowInTextSolution(false);
        setInTextNextClicks(0);
        setInTextAccessBlocked(false);
        setCurrentQuestion(0);
        setAnswers([]);
        setShowResults(false);
      } catch (err) {
        console.error("Error fetching chapter:", err);
      }
    };

    fetchChapter();
  }, [id]);

  useEffect(() => {
    if (chapter?.subject) {
      const fetchAllChapters = async () => {
        try {
          const res = await api.get(`/subjects/${chapter.subject._id || chapter.subject}/chapters`);
          setAllChapters(res.data);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching chapters:", err);
          setLoading(false);
        }
      };
      fetchAllChapters();
    }
  }, [chapter]);
  const isAuthRequiredForContent = !isAuthenticated && inTextAccessBlocked;

  if (loading) return <p className="p-4">Loading...</p>;
  if (!chapter) return <p className="p-4">Chapter not found.</p>;

  // Handle both full content and restricted preview payloads.
  // Backend returns `content` for authorized users and `contentPreview` for guests.
  let questionsContent = [];
  if (Array.isArray(chapter.content)) {
    questionsContent = chapter.content;
  } else if (Array.isArray(chapter.contentPreview)) {
    questionsContent = chapter.contentPreview;
  }
  const numCorrect = questionsContent.map((q, index) => answers[index] === q.answer ? 1 : 0).reduce((a, b) => a + b, 0);

  return (
    <div className="chapter-page">
      {/* Left Side Panel */}
      <div className="chapter-sidebar-left">
        <h3 className="sidebar-title">Chapters</h3>
        <div className="chapter-list">
          {allChapters
            .sort((a, b) => (a.number || 0) - (b.number || 0))
            .map(ch => (
            <div key={ch._id} className={`chapter-item-sidebar ${ch._id === id ? 'current' : ''}`}>
              <div
                className="chapter-link"
                onClick={() => navigate(`/chapter/${ch._id}`)}
              >
                {ch.number}. {ch.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="chapter-main">
        <h1 className="chapter-heading">{chapter.name || chapter.title}</h1>

      {/* Section Links */}
        <div className="section-links">
          <button
            className={`section-link-btn ${activeSection === "in-text" ? "active" : ""}`}
            onClick={() => {
              setActiveSection("in-text");
            }}
          >
            In-Text Solutions
          </button>
          <button
            className={`section-link-btn ${activeSection === "test-yourself" ? "active" : ""}`}
            onClick={() => {
              setActiveSection("test-yourself");
            }}
          >
            {hasPaid ? 'Test Yourself (MCQs)' : 'Test Yourself (MCQs)'}
          </button>
        </div>

      {/* Content */}
      {isAuthRequiredForContent ? (
        <div className="section-content">
          <h2 className="section-title">Login Required</h2>
          <p style={{ marginBottom: 16 }}>
            Please sign up or log in to continue viewing chapter content.
          </p>
          <button className="view-solution-btn" onClick={() => {
            setAuthReturnSection("in-text");
            setShowAuthModal(true);
          }}>
            Continue with Login / Signup
          </button>
        </div>
      ) : activeSection === "in-text" && (
        <div className="section-content" ref={inTextRef}>
          <h2 className="section-title">In-Text Solutions</h2>
          {chapter.videoUrl && (
            <div className="chapter-video-wrapper" style={{ marginBottom: 18 }}>
              <iframe
                title="chapter-video"
                src={chapter.videoUrl}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: 420, borderRadius: 8 }}
              />
            </div>
          )}
          
          {/* Chapter Content Markdown Render */}
          {chapter.content && typeof chapter.content === 'string' && (
            <div className="chapter-content-markdown" style={{ marginBottom: 30, padding: 20, background: '#fff', borderRadius: 8 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({...props}) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '16px 0' }} {...props} />,
                  th: ({...props}) => <th style={{ border: '1px solid #ddd', padding: '8px 12px', backgroundColor: '#f5f5f5', fontWeight: 600 }} {...props} />,
                  td: ({...props}) => <td style={{ border: '1px solid #ddd', padding: '8px 12px' }} {...props} />,
                  h1: ({...props}) => <h1 style={{ fontSize: '1.8rem', margin: '20px 0 10px', color: '#2c3e50' }} {...props} />,
                  h2: ({...props}) => <h2 style={{ fontSize: '1.4rem', margin: '16px 0 8px', color: '#34495e' }} {...props} />,
                  h3: ({...props}) => <h3 style={{ fontSize: '1.2rem', margin: '14px 0 6px' }} {...props} />,
                  code: ({...props}) => <code style={{ backgroundColor: '#f8f9fa', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }} {...props} />,
                  pre: ({...props}) => <pre style={{ backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, overflowX: 'auto' }} {...props} />
                }}
              >
                {chapter.content}
              </ReactMarkdown>
            </div>
          )}

              <div className="in-text-solutions">
            {questionsContent.length > 0 ? (
              <div className="question-block">
                <div className="question-header">
                  <p className="question-number">Question {currentInTextQuestion + 1} of {questionsContent.length}</p>
                  <div className="question-progress">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${((currentInTextQuestion + 1) / questionsContent.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div 
                  className="answer-content question-text" 
                  dangerouslySetInnerHTML={{ __html: questionsContent[currentInTextQuestion].question }} 
                />
                
                {!showInTextSolution && (
                  <button className="view-solution-btn" onClick={() => setShowInTextSolution(true)}>
                    View Solution
                  </button>
                )}
                
                {showInTextSolution && (
                  <div className="solution-block">
                    <div className="answer-block">
                      <p><strong className="answer-label">Answer:</strong></p>
                      <p className="answer-text">{questionsContent[currentInTextQuestion].options?.[questionsContent[currentInTextQuestion].answer]}</p>
                    </div>
                    
                    {questionsContent[currentInTextQuestion].reason && (
                      <div className="explanation-block">
                        <p><strong className="explanation-label">Explanation:</strong></p>
                        <div 
                          className="answer-content" 
                          dangerouslySetInnerHTML={{ __html: questionsContent[currentInTextQuestion].reason }} 
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div className={`navigation-buttons ${currentInTextQuestion === 0 ? "align-right" : ""}`}>
                  {currentInTextQuestion > 0 && (
                    <button 
                      className="nav-btn prev-btn"
                      onClick={() => {
                        setCurrentInTextQuestion(currentInTextQuestion - 1);
                        setShowInTextSolution(false);
                      }}
                    >
                      ← Previous
                    </button>
                  )}
                  {currentInTextQuestion < questionsContent.length - 1 && (
                    <button 
                      className="nav-btn next-btn"
                      onClick={() => {
                        if (!isAuthenticated) {
                          const nextClickCount = inTextNextClicks + 1;
                          setInTextNextClicks(nextClickCount);
                          if (nextClickCount >= 2) {
                            setAuthReturnSection("in-text");
                            setInTextAccessBlocked(true);
                            setShowAuthModal(true);
                            return;
                          }
                        }
                        setCurrentInTextQuestion(currentInTextQuestion + 1);
                        setShowInTextSolution(false);
                      }}
                    >
                      Next →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p>No solutions available.</p>
            )}
          </div>
        </div>
      )}

      {activeSection === "test-yourself" && (
        <div className="section-content">
          <h2 className="section-title">Test Yourself (MCQs)</h2>
          {showResults ? (
            <div className="results">
              <h2>Results</h2>
              <p>You got {numCorrect} out of {questionsContent.length} correct.</p>
              {questionsContent.map((q, index) => (
                <div key={q._id || index} className="result-question">
                  <p><strong>Question {index + 1}:</strong></p>
                  <div 
                    className="answer-content" 
                    dangerouslySetInnerHTML={{ __html: q.question }} 
                  />
                  <div className="answer-row">
                    <p className="your-answer">Your answer: {q.options?.[answers[index]] || 'Not answered'}</p>
                    <p className="correct-answer">Correct answer: {q.options?.[q.answer]}</p>
                  </div>
                  {q.reason && (
                    <>
                      <p><strong>Explanation:</strong></p>
                      <div 
                        className="answer-content" 
                        dangerouslySetInnerHTML={{ __html: q.reason }} 
                      />
                    </>
                  )}
                </div>
              ))}
              <button onClick={() => {
                setShowResults(false);
                setCurrentQuestion(0);
                setAnswers([]);
              }}>Retake Test</button>
            </div>
          ) : (
            <div className="mcq-test">
              {currentQuestion < questionsContent.length ? (
                <div className="question-block">
                <p>Question {currentQuestion + 1}</p>
                <div 
                  className="answer-content" 
                  dangerouslySetInnerHTML={{ __html: questionsContent[currentQuestion].question }} 
                />
                  <div className="mcq-options">
                    {questionsContent[currentQuestion].options?.map((op, i) => (
                      <button
                        key={i}
                        className={`mcq-option ${answers[currentQuestion] === i ? 'selected' : ''}`}
                        onClick={() => {
                          const newAnswers = [...answers];
                          newAnswers[currentQuestion] = i;
                          setAnswers(newAnswers);
                        }}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                  <div className="nav-buttons">
                    {currentQuestion > 0 && (
                      <button onClick={() => setCurrentQuestion(currentQuestion - 1)}>Previous</button>
                    )}
                    <button
                      onClick={() => {
                        if (currentQuestion === 0 && !hasPaid) {
                          setLocked(true);
                        } else if (currentQuestion < questionsContent.length - 1) {
                          setCurrentQuestion(currentQuestion + 1);
                        } else {
                          setShowResults(true);
                        }
                      }}
                    >
                      {currentQuestion < questionsContent.length - 1 ? 'Next' : 'Finish'}
                    </button>
                  </div>
                </div>
              ) : (
                <p>No questions available.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Content for Admin */}
      {isAdmin && (
        <div className="admin-add-content">
          {!addContentOpen && (
            <button onClick={() => setAddContentOpen(true)}>Add Content</button>
          )}
          {addContentOpen && (
            <div>
              <button onClick={() => setAddContentOpen(false)}>Close Add Content</button>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const body = { question: newQuestion, reason: newReason };
                if (addingMCQ) {
                  body.options = newOptions;
                  body.answer = parseInt(newAnswer);
                }
                try {
                  await api.post(`/chapters/${id}/questions`, body);
                  alert('Content added!');
                  window.location.reload(); // refresh to see new content
                } catch (err) {
                  console.error('Error adding content:', err);
                  alert('Failed to add content.');
                }
              }}>
                <label>
                  Question:
                  <textarea value={newQuestion} onChange={e => setNewQuestion(e.target.value)} required />
                </label>
                <br />
                <label>
                  <input type="checkbox" checked={addingMCQ} onChange={() => setAddingMCQ(!addingMCQ)} />
                  Add as MCQ
                </label>
                <br />
                {addingMCQ && (
                  <div>
                    Options (one per line):
                    {newOptions.map((op, i) => (
                      <input
                        key={i}
                        value={op}
                        onChange={e => setNewOptions(o => o.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={`Option ${i + 1}`}
                      />
                    ))}
                    Correct Answer Index: <select value={newAnswer} onChange={e => setNewAnswer(parseInt(e.target.value))}>
                      <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                    </select>
                  </div>
                )}
                <br />
                <label>
                  Explanation/Reason:
                  <textarea value={newReason} onChange={e => setNewReason(e.target.value)} required />
                </label>
                <br />
                <button type="submit">Add Content</button>
              </form>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="auth-modal-overlay">
          <Signup isModal={true} onSuccess={handleAuthSuccess} />
        </div>
      )}

      {/* Lock Overlay for Test after first question */}
      {locked && activeSection === "test-yourself" && (
        <div className="lock-overlay">
          <div className="lock-card">
            <h3>Unlock Full Test</h3>
            <p>Subscribe for Rs 99 to access all questions and results.</p>
            <button className="subscribe-btn" onClick={async () => {
              try {
                await api.put("/auth/payment", { payment: true });
                localStorage.setItem("hasPaid", "true");
                setLocked(false);
                alert("Payment successful!");
              } catch (err) {
                console.error("Payment failed:", err);
                alert("Payment failed. Please try again.");
              }
            }}>Subscribe - Rs 99</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterView;
