"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Activity, 
  Zap, 
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Trophy,
  Timer,
  Database,
  Wifi,
  WifiOff,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';

// Importar sistema de banco de dados
import { blazeDB, BlazeResult, Pattern, GameStats, analyzeColorFrequency, findStreaks, calculateGaps } from '@/lib/database';
import { tipMinerAPI, syncWithTipMiner, detectAnomalies } from '@/lib/tipminer';

interface Prediction {
  color: 'red' | 'black' | 'white';
  confidence: number;
  algorithm: string;
  reasoning: string;
  entryTiming: 'NEXT' | 'WAIT_1' | 'WAIT_2';
}

interface Signal {
  action: 'BET' | 'WAIT';
  color?: 'red' | 'black' | 'white';
  confidence: number;
  strategy: string;
  reasoning: string;
  timestamp: Date;
  entryTiming: 'NEXT' | 'WAIT_1' | 'WAIT_2';
  roundsToWait: number;
}

export default function BlazeAI() {
  const [mounted, setMounted] = useState(false);
  const [results, setResults] = useState<BlazeResult[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(null);
  const [currentSignal, setCurrentSignal] = useState<Signal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats>({
    totalPredictions: 0,
    correctPredictions: 0,
    accuracy: 0,
    greens: 0,
    reds: 0,
    currentStreak: 0,
    bestStreak: 0,
    profit: 0
  });
  const [lastPredictedColor, setLastPredictedColor] = useState<'red' | 'black' | 'white' | null>(null);
  const [showGreenAlert, setShowGreenAlert] = useState(false);
  const [showRedAlert, setShowRedAlert] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [nextEntry, setNextEntry] = useState<'NEXT' | 'WAIT_1' | 'WAIT_2'>('NEXT');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Evitar hidration mismatch - só renderizar após montar no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Carregar dados salvos ao inicializar
  useEffect(() => {
    if (!mounted) return;
    
    const loadSavedData = () => {
      // Carregar resultados salvos
      const savedResults = blazeDB.loadResults();
      if (savedResults.length > 0) {
        setResults(savedResults);
      } else {
        // Se não há dados salvos, gerar dados iniciais
        initializeWithSimulatedData();
      }

      // Carregar estatísticas salvas
      const savedStats = blazeDB.loadStats();
      if (savedStats) {
        setGameStats(savedStats);
      }

      // Carregar padrões salvos
      const savedPatterns = blazeDB.loadPatterns();
      if (savedPatterns.length > 0) {
        setPatterns(savedPatterns);
      }
    };

    loadSavedData();
  }, [mounted]);

  // Simular dados realistas da Blaze
  const generateRealisticResult = useCallback((): BlazeResult => {
    const now = new Date();
    
    // Probabilidades realistas da Blaze
    const rand = Math.random();
    let color: 'red' | 'black' | 'white';
    let number: number;
    
    if (rand < 0.02) { // 2% chance de branco (0)
      color = 'white';
      number = 0;
    } else if (rand < 0.51) { // 49% chance de vermelho (1-7)
      color = 'red';
      number = Math.floor(Math.random() * 7) + 1;
    } else { // 49% chance de preto (8-14)
      color = 'black';
      number = Math.floor(Math.random() * 7) + 8;
    }
    
    return {
      id: Date.now() + Math.random(),
      color,
      number,
      timestamp: now
    };
  }, []);

  // Inicializar com dados históricos simulados
  const initializeWithSimulatedData = useCallback(() => {
    const initialResults: BlazeResult[] = [];
    const now = new Date();
    
    for (let i = 200; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000); // 1 minuto entre cada resultado
      const result = generateRealisticResult();
      result.timestamp = timestamp;
      result.id = timestamp.getTime();
      initialResults.push(result);
    }
    
    setResults(initialResults);
    blazeDB.saveResults(initialResults);
  }, [generateRealisticResult]);

  // Análise de padrões avançada
  const analyzePatterns = useCallback((data: BlazeResult[]) => {
    const foundPatterns: Pattern[] = [];
    const sequences = data.map(r => r.color);
    
    // Analisar sequências de 3 a 10 elementos
    for (let length = 3; length <= 10; length++) {
      const patternMap = new Map<string, { count: number, predictions: string[], correct: number }>();
      
      for (let i = 0; i <= sequences.length - length - 1; i++) {
        const pattern = sequences.slice(i, i + length).join('-');
        const nextColor = sequences[i + length];
        
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { count: 0, predictions: [], correct: 0 });
        }
        
        const patternData = patternMap.get(pattern)!;
        patternData.count++;
        patternData.predictions.push(nextColor);
      }
      
      // Calcular precisão dos padrões
      patternMap.forEach((data, pattern) => {
        if (data.count >= 5) { // Mínimo 5 ocorrências
          const colorCounts = { red: 0, black: 0, white: 0 };
          data.predictions.forEach(color => colorCounts[color as keyof typeof colorCounts]++);
          
          const mostCommon = Object.entries(colorCounts).reduce((a, b) => 
            a[1] > b[1] ? a : b
          )[0] as 'red' | 'black' | 'white';
          
          const accuracy = (colorCounts[mostCommon] / data.predictions.length) * 100;
          
          if (accuracy > 65) { // Apenas padrões com >65% de precisão
            foundPatterns.push({
              id: `pattern_${Date.now()}_${Math.random()}`,
              sequence: pattern.split('-'),
              frequency: data.count,
              accuracy,
              lastSeen: new Date(),
              nextPrediction: mostCommon
            });
          }
        }
      });
    }
    
    const sortedPatterns = foundPatterns.sort((a, b) => b.accuracy - a.accuracy).slice(0, 30);
    
    // Salvar padrões no banco de dados
    blazeDB.savePatterns(sortedPatterns);
    
    return sortedPatterns;
  }, []);

  // Algoritmos de predição melhorados
  const generatePredictions = useCallback((data: BlazeResult[], patterns: Pattern[]): Prediction[] => {
    const predictions: Prediction[] = [];
    const recent = data.slice(-15).map(r => r.color);
    
    // Algoritmo 1: Análise de Padrões Sequenciais
    for (let len = 5; len >= 3; len--) {
      const currentSequence = recent.slice(-len).join('-');
      const matchingPattern = patterns.find(p => 
        p.sequence.slice(0, -1).join('-') === currentSequence
      );
      
      if (matchingPattern && matchingPattern.accuracy > 70) {
        const timing = matchingPattern.accuracy > 85 ? 'NEXT' : 
                     matchingPattern.accuracy > 75 ? 'WAIT_1' : 'WAIT_2';
        
        predictions.push({
          color: matchingPattern.nextPrediction,
          confidence: matchingPattern.accuracy,
          algorithm: 'Pattern Sequence',
          reasoning: `Padrão ${matchingPattern.sequence.join('-')} com ${matchingPattern.accuracy.toFixed(1)}% de precisão`,
          entryTiming: timing
        });
        break;
      }
    }
    
    // Algoritmo 2: Análise de Frequência Inteligente
    const last10 = recent.slice(-10);
    const colorCounts = { red: 0, black: 0, white: 0 };
    last10.forEach(color => colorCounts[color]++);
    
    const sortedColors = Object.entries(colorCounts).sort((a, b) => a[1] - b[1]);
    const leastFrequent = sortedColors[0][0] as 'red' | 'black' | 'white';
    
    // Se uma cor está muito ausente, apostar nela
    if (colorCounts[leastFrequent] === 0 && last10.length >= 8) {
      predictions.push({
        color: leastFrequent,
        confidence: 78,
        algorithm: 'Frequency Gap',
        reasoning: `${leastFrequent} não aparece há ${last10.length} rodadas`,
        entryTiming: 'NEXT'
      });
    }
    
    // Algoritmo 3: Análise de Streaks e Reversão
    let currentStreak = 1;
    let streakColor = recent[recent.length - 1];
    
    for (let i = recent.length - 2; i >= 0; i--) {
      if (recent[i] === streakColor) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    if (currentStreak >= 4 && streakColor !== 'white') {
      const oppositeColor = streakColor === 'red' ? 'black' : 'red';
      const confidence = Math.min(88, 65 + currentStreak * 4);
      
      predictions.push({
        color: oppositeColor,
        confidence,
        algorithm: 'Streak Reversal',
        reasoning: `Streak de ${currentStreak} ${streakColor}s - alta probabilidade de reversão`,
        entryTiming: currentStreak >= 6 ? 'NEXT' : 'WAIT_1'
      });
    }
    
    // Algoritmo 4: Análise Específica do Branco
    const whiteGap = recent.slice().reverse().findIndex(color => color === 'white');
    const actualGap = whiteGap === -1 ? recent.length : whiteGap;
    
    if (actualGap >= 40) {
      predictions.push({
        color: 'white',
        confidence: Math.min(85, 60 + (actualGap - 40) * 2),
        algorithm: 'White Prediction',
        reasoning: `Branco não sai há ${actualGap} rodadas - probabilidade crítica`,
        entryTiming: actualGap >= 60 ? 'NEXT' : 'WAIT_1'
      });
    }
    
    // Algoritmo 5: Análise de Padrões Alternados
    const last6 = recent.slice(-6);
    const isAlternating = last6.every((color, i) => {
      if (i === 0) return true;
      return color !== last6[i - 1];
    });
    
    if (isAlternating && last6.length >= 4) {
      const lastColor = last6[last6.length - 1];
      const predictedColor = lastColor === 'red' ? 'black' : 'red';
      
      predictions.push({
        color: predictedColor,
        confidence: 72,
        algorithm: 'Alternating Pattern',
        reasoning: `Padrão alternado detectado - próxima cor: ${predictedColor}`,
        entryTiming: 'NEXT'
      });
    }
    
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }, []);

  // Geração de sinais melhorada
  const generateSignal = useCallback((predictions: Prediction[]): Signal => {
    if (predictions.length === 0) {
      return {
        action: 'WAIT',
        confidence: 0,
        strategy: 'Insufficient Data',
        reasoning: 'Aguardando mais dados para análise',
        timestamp: new Date(),
        entryTiming: 'NEXT',
        roundsToWait: 0
      };
    }
    
    const bestPrediction = predictions[0];
    const consensusCount = predictions.filter(p => p.color === bestPrediction.color).length;
    const avgConfidence = predictions
      .filter(p => p.color === bestPrediction.color)
      .reduce((sum, p) => sum + p.confidence, 0) / consensusCount;
    
    // Determinar timing de entrada
    const timingCounts = { NEXT: 0, WAIT_1: 0, WAIT_2: 0 };
    predictions.filter(p => p.color === bestPrediction.color)
      .forEach(p => timingCounts[p.entryTiming]++);
    
    const bestTiming = Object.entries(timingCounts).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0] as 'NEXT' | 'WAIT_1' | 'WAIT_2';
    
    const roundsToWait = bestTiming === 'NEXT' ? 0 : bestTiming === 'WAIT_1' ? 1 : 2;
    
    if (avgConfidence >= 75 && consensusCount >= 2) {
      return {
        action: 'BET',
        color: bestPrediction.color,
        confidence: avgConfidence,
        strategy: 'High Confidence',
        reasoning: `${consensusCount} algoritmos concordam em ${bestPrediction.color} com ${avgConfidence.toFixed(1)}% de confiança`,
        timestamp: new Date(),
        entryTiming: bestTiming,
        roundsToWait
      };
    } else if (avgConfidence >= 65) {
      return {
        action: 'BET',
        color: bestPrediction.color,
        confidence: avgConfidence,
        strategy: 'Medium Confidence',
        reasoning: `Sinal moderado para ${bestPrediction.color} - aguarde ${roundsToWait} rodada(s)`,
        timestamp: new Date(),
        entryTiming: bestTiming,
        roundsToWait
      };
    } else {
      return {
        action: 'WAIT',
        confidence: avgConfidence,
        strategy: 'Low Confidence',
        reasoning: 'Confiança insuficiente - aguarde melhor oportunidade',
        timestamp: new Date(),
        entryTiming: 'NEXT',
        roundsToWait: 0
      };
    }
  }, []);

  // Análise principal
  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const foundPatterns = analyzePatterns(results);
      const predictions = generatePredictions(results, foundPatterns);
      const signal = generateSignal(predictions);
      
      setPatterns(foundPatterns);
      setCurrentPrediction(predictions[0] || null);
      setCurrentSignal(signal);
      setNextEntry(signal.entryTiming);
      
      setIsAnalyzing(false);
    }, 1500);
  }, [results, analyzePatterns, generatePredictions, generateSignal]);

  // Sincronizar com TipMiner
  const syncData = async () => {
    setIsSyncing(true);
    try {
      const syncResult = await syncWithTipMiner();
      if (syncResult.success) {
        setLastSync(new Date());
        setIsOnline(true);
        
        // Se há novos resultados, atualizar
        if (syncResult.newResults > 0) {
          const newData = await tipMinerAPI.fetchHistoricalData(100);
          if (newData.length > 0) {
            setResults(newData);
            blazeDB.saveResults(newData);
          }
        }
      } else {
        setIsOnline(false);
        console.error('Erro na sincronização:', syncResult.error);
      }
    } catch (error) {
      setIsOnline(false);
      console.error('Erro ao sincronizar:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Simular novos resultados com verificação de acerto
  const addNewResult = () => {
    const newResult = generateRealisticResult();
    
    // Verificar se houve predição anterior
    if (lastPredictedColor && currentSignal?.action === 'BET') {
      const wasCorrect = newResult.color === lastPredictedColor;
      newResult.predicted = true;
      newResult.wasCorrect = wasCorrect;
      
      // Salvar predição no histórico
      blazeDB.savePrediction({
        id: `pred_${Date.now()}`,
        timestamp: new Date(),
        predictedColor: lastPredictedColor,
        actualColor: newResult.color,
        confidence: currentSignal.confidence,
        algorithm: currentPrediction?.algorithm || 'Unknown',
        wasCorrect,
        entryTiming: currentSignal.entryTiming
      });
      
      // Atualizar estatísticas
      const newStats = {
        ...gameStats,
        totalPredictions: gameStats.totalPredictions + 1,
        correctPredictions: gameStats.correctPredictions + (wasCorrect ? 1 : 0),
        greens: gameStats.greens + (wasCorrect ? 1 : 0),
        reds: gameStats.reds + (wasCorrect ? 0 : 1),
        currentStreak: wasCorrect ? gameStats.currentStreak + 1 : 0,
        profit: gameStats.profit + (wasCorrect ? 14 : -10) // Simulando payout 14x para acerto
      };
      
      newStats.accuracy = (newStats.correctPredictions / newStats.totalPredictions) * 100;
      newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
      
      setGameStats(newStats);
      blazeDB.saveStats(newStats);
      
      // Mostrar feedback visual
      if (wasCorrect) {
        setShowGreenAlert(true);
        setTimeout(() => setShowGreenAlert(false), 3000);
      } else {
        setShowRedAlert(true);
        setTimeout(() => setShowRedAlert(false), 3000);
      }
    }
    
    const updatedResults = [...results.slice(-199), newResult];
    setResults(updatedResults);
    blazeDB.addResult(newResult);
    setLastPredictedColor(currentSignal?.color || null);
  };

  // Sistema de countdown para próxima entrada
  useEffect(() => {
    if (currentSignal?.roundsToWait > 0) {
      setCountdown(currentSignal.roundsToWait);
    } else {
      setCountdown(0);
    }
  }, [currentSignal]);

  // Auto-análise quando novos dados chegam
  useEffect(() => {
    if (results.length > 0 && mounted) {
      runAnalysis();
    }
  }, [results, runAnalysis, mounted]);

  // Simulação de dados ao vivo
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLive && mounted) {
      interval = setInterval(() => {
        addNewResult();
      }, 15000); // Novo resultado a cada 15 segundos
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, currentSignal, lastPredictedColor, mounted]);

  // Verificar status da API periodicamente
  useEffect(() => {
    if (!mounted) return;
    
    const checkStatus = async () => {
      const status = await tipMinerAPI.checkAPIStatus();
      setIsOnline(status);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Verificar a cada minuto
    
    return () => clearInterval(interval);
  }, [mounted]);

  const getColorClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-500 text-white';
      case 'black': return 'bg-gray-900 text-white';
      case 'white': return 'bg-white text-black border-2 border-gray-300';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getColorName = (color: string) => {
    switch (color) {
      case 'red': return 'Vermelho';
      case 'black': return 'Preto';
      case 'white': return 'Branco';
      default: return color;
    }
  };

  const getTimingText = (timing: string) => {
    switch (timing) {
      case 'NEXT': return 'PRÓXIMA RODADA';
      case 'WAIT_1': return 'AGUARDE 1 RODADA';
      case 'WAIT_2': return 'AGUARDE 2 RODADAS';
      default: return timing;
    }
  };

  // Não renderizar até estar montado no cliente
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <div className="text-2xl font-bold text-white mb-2">Carregando Blaze AI...</div>
          <div className="text-gray-400">Inicializando sistema de análise</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alertas de Feedback */}
        {showGreenAlert && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <Card className="bg-green-500 border-green-400 shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-white" />
                  <div>
                    <div className="text-xl font-bold text-white">🎉 GREEN! 🎉</div>
                    <div className="text-sm text-green-100">Predição correta!</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showRedAlert && (
          <div className="fixed top-4 right-4 z-50 animate-pulse">
            <Card className="bg-red-500 border-red-400 shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-white" />
                  <div>
                    <div className="text-xl font-bold text-white">❌ RED ❌</div>
                    <div className="text-sm text-red-100">Predição incorreta</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Brain className="w-12 h-12 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Blaze AI Predictor</h1>
            <Database className="w-8 h-8 text-green-400" />
            {isOnline ? (
              <Wifi className="w-6 h-6 text-green-400" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-400" />
            )}
          </div>
          <p className="text-gray-300 text-lg">
            Sistema Inteligente de Análise e Predição da Blaze Double
          </p>
          
          {/* Status da Conexão */}
          <div className="flex justify-center items-center gap-4 text-sm">
            <div className={`flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {lastSync && (
              <div className="text-gray-400">
                Última sync: {lastSync.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          {/* Estatísticas Rápidas */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-green-400">
              <span className="font-bold">{gameStats.accuracy.toFixed(1)}%</span> Precisão
            </div>
            <div className="text-blue-400">
              <span className="font-bold">{gameStats.greens}</span> Greens
            </div>
            <div className="text-red-400">
              <span className="font-bold">{gameStats.reds}</span> Reds
            </div>
            <div className="text-yellow-400">
              <span className="font-bold">{gameStats.currentStreak}</span> Streak
            </div>
          </div>
        </div>

        {/* Sinal Principal */}
        {currentSignal && (
          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="w-6 h-6 text-yellow-400" />
                Sinal Atual
                {isLive && <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse ml-2"></div>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {currentSignal.action === 'BET' ? (
                      <CheckCircle className="w-12 h-12 text-green-400" />
                    ) : (
                      <XCircle className="w-12 h-12 text-red-400" />
                    )}
                    <div>
                      <div className="text-3xl font-bold text-white">
                        {currentSignal.action === 'BET' ? 'APOSTAR' : 'AGUARDAR'}
                      </div>
                      {currentSignal.color && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-300">Cor:</span>
                          <Badge className={`${getColorClass(currentSignal.color)} text-lg px-3 py-1`}>
                            {getColorName(currentSignal.color)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Timing de Entrada */}
                  <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="w-5 h-5 text-blue-400" />
                      <span className="font-bold text-blue-400">Timing de Entrada</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {getTimingText(currentSignal.entryTiming)}
                    </div>
                    {countdown > 0 && (
                      <div className="text-sm text-gray-300 mt-1">
                        Aguarde {countdown} rodada(s) antes de apostar
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="text-right">
                    <div className="text-4xl font-bold text-blue-400">
                      {currentSignal.confidence.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Confiança</div>
                    <Progress value={currentSignal.confidence} className="h-3 mt-2" />
                  </div>
                  
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-300">
                      <strong>Estratégia:</strong> {currentSignal.strategy}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      <strong>Análise:</strong> {currentSignal.reasoning}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800/50">
            <TabsTrigger value="analysis" className="text-white">Análise</TabsTrigger>
            <TabsTrigger value="patterns" className="text-white">Padrões</TabsTrigger>
            <TabsTrigger value="history" className="text-white">Histórico</TabsTrigger>
            <TabsTrigger value="stats" className="text-white">Estatísticas</TabsTrigger>
            <TabsTrigger value="performance" className="text-white">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Predição Atual */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Target className="w-5 h-5 text-green-400" />
                    Predição Principal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentPrediction ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className={`${getColorClass(currentPrediction.color)} text-lg px-3 py-1`}>
                          {getColorName(currentPrediction.color)}
                        </Badge>
                        <div className="text-2xl font-bold text-blue-400">
                          {currentPrediction.confidence.toFixed(1)}%
                        </div>
                      </div>
                      <Progress value={currentPrediction.confidence} className="h-2" />
                      <div className="text-sm text-gray-300">
                        <div><strong>Algoritmo:</strong> {currentPrediction.algorithm}</div>
                        <div className="mt-1"><strong>Timing:</strong> {getTimingText(currentPrediction.entryTiming)}</div>
                        <div className="mt-1"><strong>Análise:</strong> {currentPrediction.reasoning}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      Analisando dados...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Controles */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Controles do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={runAnalysis} 
                    disabled={isAnalyzing}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-2" />
                        Executar Análise
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={syncData}
                    disabled={isSyncing}
                    variant="outline"
                    className="w-full border-gray-600 text-white hover:bg-gray-700"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Sincronizar Dados
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => setIsLive(!isLive)}
                    variant={isLive ? "destructive" : "default"}
                    className="w-full"
                  >
                    {isLive ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Parar Simulação
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar Simulação
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={addNewResult}
                    variant="outline"
                    className="w-full border-gray-600 text-white hover:bg-gray-700"
                    disabled={isLive}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Simular Resultado
                  </Button>
                  
                  <div className="text-xs text-gray-400 text-center">
                    {isLive ? 'Sistema ativo - atualizando automaticamente' : 'Sistema pausado'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Padrões Identificados ({patterns.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {patterns.slice(0, 15).map((pattern, index) => (
                    <div key={pattern.id || index} className="p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {pattern.sequence.map((color, i) => (
                            <Badge key={i} className={`${getColorClass(color)} text-xs`}>
                              {color === 'red' ? 'V' : color === 'black' ? 'P' : 'B'}
                            </Badge>
                          ))}
                          <span className="text-gray-400">→</span>
                          <Badge className={`${getColorClass(pattern.nextPrediction)} text-xs font-bold`}>
                            {pattern.nextPrediction === 'red' ? 'V' : pattern.nextPrediction === 'black' ? 'P' : 'B'}
                          </Badge>
                        </div>
                        <div className="text-sm text-blue-400 font-bold">
                          {pattern.accuracy.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        Frequência: {pattern.frequency} vezes | Próxima predição: {getColorName(pattern.nextPrediction)}
                      </div>
                    </div>
                  ))}
                  {patterns.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      Nenhum padrão identificado ainda
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-2">
                  {results.slice(-60).map((result) => (
                    <div
                      key={result.id}
                      className={`${getColorClass(result.color)} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative ${
                        result.predicted ? 'ring-2 ring-yellow-400' : ''
                      }`}
                      title={`${result.number} - ${result.timestamp.toLocaleTimeString()}${
                        result.predicted ? ` - ${result.wasCorrect ? 'GREEN' : 'RED'}` : ''
                      }`}
                    >
                      {result.number}
                      {result.predicted && (
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                          result.wasCorrect ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-400 text-center">
                  Últimos 60 resultados | Círculos com borda = predições | Verde/Vermelho = acerto/erro
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-400">{results.length}</div>
                  <div className="text-sm text-gray-400">Resultados Analisados</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-400">{patterns.length}</div>
                  <div className="text-sm text-gray-400">Padrões Encontrados</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-400">
                    {patterns.length > 0 ? patterns[0].accuracy.toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-sm text-gray-400">Melhor Padrão</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-400">
                    {results.length > 0 ? ((results.filter(r => r.color === 'white').length / results.length) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-sm text-gray-400">Frequência do Branco</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Análise Detalhada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                    <div className="text-lg font-bold text-red-400">Último Vermelho</div>
                    <div className="text-2xl font-bold text-white">
                      {results.length > 0 ? results.slice().reverse().findIndex(r => r.color === 'red') : 0}
                    </div>
                    <div className="text-sm text-gray-400">Rodadas atrás</div>
                  </div>
                  
                  <div className="p-4 bg-gray-500/20 rounded-lg border border-gray-500/30">
                    <div className="text-lg font-bold text-gray-400">Último Preto</div>
                    <div className="text-2xl font-bold text-white">
                      {results.length > 0 ? results.slice().reverse().findIndex(r => r.color === 'black') : 0}
                    </div>
                    <div className="text-sm text-gray-400">Rodadas atrás</div>
                  </div>
                  
                  <div className="p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <div className="text-lg font-bold text-yellow-400">Último Branco</div>
                    <div className="text-2xl font-bold text-white">
                      {results.length > 0 ? results.slice().reverse().findIndex(r => r.color === 'white') : 0}
                    </div>
                    <div className="text-sm text-gray-400">Rodadas atrás</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-green-500/20 border-green-500/30">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-400">{gameStats.accuracy.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400">Precisão Geral</div>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-500/20 border-blue-500/30">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-400">{gameStats.greens}</div>
                  <div className="text-sm text-gray-400">Total de Greens</div>
                </CardContent>
              </Card>
              
              <Card className="bg-red-500/20 border-red-500/30">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-400">{gameStats.reds}</div>
                  <div className="text-sm text-gray-400">Total de Reds</div>
                </CardContent>
              </Card>
              
              <Card className="bg-yellow-500/20 border-yellow-500/30">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-400">{gameStats.currentStreak}</div>
                  <div className="text-sm text-gray-400">Streak Atual</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Performance Detalhada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-white mb-2">Estatísticas de Jogo</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total de Predições:</span>
                          <span className="text-white font-bold">{gameStats.totalPredictions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Predições Corretas:</span>
                          <span className="text-green-400 font-bold">{gameStats.correctPredictions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Melhor Streak:</span>
                          <span className="text-yellow-400 font-bold">{gameStats.bestStreak}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-white mb-2">Simulação de Lucro</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Lucro Simulado:</span>
                          <span className={`font-bold ${gameStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {gameStats.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ROI:</span>
                          <span className={`font-bold ${gameStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {gameStats.totalPredictions > 0 ? 
                              ((gameStats.profit / (gameStats.totalPredictions * 10)) * 100).toFixed(1) : '0.0'
                            }%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {gameStats.totalPredictions > 0 && (
                  <div className="mt-6">
                    <div className="text-sm text-gray-400 mb-2">Taxa de Acerto</div>
                    <Progress value={gameStats.accuracy} className="h-3" />
                    <div className="text-xs text-gray-400 mt-1 text-center">
                      {gameStats.accuracy.toFixed(1)}% de precisão em {gameStats.totalPredictions} predições
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-200">
                <strong>Aviso Importante:</strong> Este sistema é apenas para fins educacionais e de demonstração. 
                Jogos de azar envolvem riscos financeiros. Jogue com responsabilidade e apenas o que pode perder.
                Os resultados passados não garantem resultados futuros. Sistema com dados simulados para demonstração.
                Para dados reais, conecte sua conta Supabase nas configurações do projeto.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}