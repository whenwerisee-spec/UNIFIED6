import React, { useState } from 'react';
import { Award, CheckCircle, BookOpen, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Quiz, QuizQuestion } from '../types';

interface EarnRewardsProps {
  quizzes: Quiz[];
  onCompleteQuiz: (quizId: string, rewardSymbol: string, rewardAmount: number) => void;
}

export default function EarnRewards({ quizzes, onCompleteQuiz }: EarnRewardsProps) {
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswerResult, setShowAnswerResult] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setShowAnswerResult(false);
    setWrongAttempts(0);
  };

  const handleOptionSelect = (optionIdx: number) => {
    if (showAnswerResult) return;
    setSelectedOption(optionIdx);
  };

  const handleAnswerSubmit = () => {
    if (selectedOption === null || !activeQuiz) return;

    const currentQuestion = activeQuiz.questions[currentQuestionIdx];
    const isCorrect = selectedOption === currentQuestion.correctAnswer;

    setShowAnswerResult(true);

    if (!isCorrect) {
      setWrongAttempts(wrongAttempts + 1);
    }
  };

  const handleNext = () => {
    if (!activeQuiz) return;

    const currentQuestion = activeQuiz.questions[currentQuestionIdx];
    const isCorrect = selectedOption === currentQuestion.correctAnswer;

    if (!isCorrect) {
      // Allow retry
      setSelectedOption(null);
      setShowAnswerResult(false);
      return;
    }

    if (currentQuestionIdx + 1 < activeQuiz.questions.length) {
      // Go to next question
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedOption(null);
      setShowAnswerResult(false);
    } else {
      // Completed entire quiz!
      onCompleteQuiz(activeQuiz.id, activeQuiz.rewardSymbol, activeQuiz.rewardAmount);
      setActiveQuiz(null);
    }
  };

  return (
    <div className="space-y-6" id="earn-rewards-section">
      {/* Quiz details / Active Quiz view */}
      {activeQuiz ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm max-w-2xl mx-auto animate-slide-up">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <div className="flex items-center space-x-2.5">
              <BookOpen className="h-5 w-5 text-[#0052FF]" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">
                Learning Module
              </span>
            </div>
            <span className="text-xs bg-[#0052FF]/10 text-[#0052FF] font-bold px-2.5 py-1 rounded-full">
              Earn ${activeQuiz.rewardAmount.toFixed(2)} {activeQuiz.rewardSymbol}
            </span>
          </div>

          {/* Quiz Q&A Body */}
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold text-gray-400 font-mono">
                QUESTION {currentQuestionIdx + 1} OF {activeQuiz.questions.length}
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-1">
                {activeQuiz.questions[currentQuestionIdx].question}
              </h3>
            </div>

            {/* Options list */}
            <div className="space-y-3">
              {activeQuiz.questions[currentQuestionIdx].options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectAnswer = idx === activeQuiz.questions[currentQuestionIdx].correctAnswer;
                
                let optionStyle = 'border-gray-200 hover:border-[#0052FF]/50 bg-white';
                if (isSelected) {
                  optionStyle = 'border-[#0052FF] bg-[#0052FF]/5';
                }
                
                if (showAnswerResult) {
                  if (isSelected && isCorrectAnswer) {
                    optionStyle = 'border-green-500 bg-green-50 text-green-900';
                  } else if (isSelected && !isCorrectAnswer) {
                    optionStyle = 'border-red-400 bg-red-50 text-red-900';
                  } else if (isCorrectAnswer) {
                    optionStyle = 'border-green-500 bg-green-50/50';
                  } else {
                    optionStyle = 'border-gray-100 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={showAnswerResult}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start space-x-3 cursor-pointer ${optionStyle}`}
                  >
                    <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center shrink-0 font-mono text-xs text-gray-400 font-semibold bg-gray-50">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Answer feedback message */}
            {showAnswerResult && (
              <div
                className={`p-4 rounded-xl text-xs sm:text-sm flex items-start space-x-3 border ${
                  selectedOption === activeQuiz.questions[currentQuestionIdx].correctAnswer
                    ? 'bg-green-50 border-green-100 text-green-800'
                    : 'bg-red-50 border-red-100 text-red-800'
                }`}
              >
                {selectedOption === activeQuiz.questions[currentQuestionIdx].correctAnswer ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold">
                    {selectedOption === activeQuiz.questions[currentQuestionIdx].correctAnswer
                      ? 'Correct Answer!'
                      : 'Incorrect, let’s try again!'}
                  </h4>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    {activeQuiz.questions[currentQuestionIdx].explanation}
                  </p>
                </div>
              </div>
            )}

            {/* Footer triggers */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-6">
              <button
                onClick={() => setActiveQuiz(null)}
                className="text-xs sm:text-sm text-gray-400 hover:text-gray-700 font-semibold"
              >
                Cancel Quiz
              </button>

              {!showAnswerResult ? (
                <button
                  disabled={selectedOption === null}
                  onClick={handleAnswerSubmit}
                  className="px-6 py-2.5 bg-[#0052FF] hover:bg-blue-700 disabled:bg-gray-200 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className={`px-6 py-2.5 text-white text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                    selectedOption === activeQuiz.questions[currentQuestionIdx].correctAnswer
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  <span>
                    {selectedOption === activeQuiz.questions[currentQuestionIdx].correctAnswer
                      ? currentQuestionIdx + 1 === activeQuiz.questions.length
                        ? 'Finish and Claim Reward'
                        : 'Next Question'
                      : 'Try Again'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Standard Quizzes Hub lists
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0052FF] to-indigo-700 rounded-3xl p-6 sm:p-8 text-white">
            <div className="max-w-md space-y-2">
              <div className="flex items-center space-x-1.5 bg-white/10 w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <Award className="h-3.5 w-3.5" />
                <span>Coinbase Learning Rewards</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Earn crypto while learning about web3 blockchain networks
              </h2>
              <p className="text-xs text-white/80 leading-relaxed">
                Complete small, educational lessons and simple quizzes to earn real cryptocurrency balances on your portfolio today.
              </p>
            </div>
            <div className="flex flex-col items-center sm:items-end justify-center">
              <span className="text-sm font-semibold text-white/70">TOTAL UNCLAIMED</span>
              <span className="text-3xl sm:text-4xl font-black mt-1">$12.00</span>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Available Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between h-full hover:shadow-xs transition-all ${
                  quiz.completed
                    ? 'border-green-100 bg-green-50/10'
                    : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-[#0052FF] bg-[#0052FF]/5 px-2.5 py-0.5 rounded-full font-mono">
                      {quiz.rewardSymbol} Lesson
                    </span>
                    {quiz.completed ? (
                      <span className="text-xs text-green-700 bg-green-100/60 font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-green-700 font-mono">
                        Earn +${quiz.rewardAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-gray-900">{quiz.title}</h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {quiz.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0052FF]" />
                    <span>Double verified safe reward</span>
                  </div>
                  {!quiz.completed ? (
                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="px-4 py-2 bg-[#0052FF] hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      Start Lesson
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">Claimed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
