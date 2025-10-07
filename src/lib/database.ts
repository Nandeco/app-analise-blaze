// Sistema de banco de dados local para armazenar dados da Blaze
export interface BlazeResult {
  id: number;
  color: 'red' | 'black' | 'white';
  number: number;
  timestamp: Date;
  predicted?: boolean;
  wasCorrect?: boolean;
}

export interface Pattern {
  id: string;
  sequence: string[];
  frequency: number;
  accuracy: number;
  lastSeen: Date;
  nextPrediction: 'red' | 'black' | 'white';
}

export interface GameStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  greens: number;
  reds: number;
  currentStreak: number;
  bestStreak: number;
  profit: number;
  lastUpdated: Date;
}

export interface PredictionHistory {
  id: string;
  timestamp: Date;
  predictedColor: 'red' | 'black' | 'white';
  actualColor: 'red' | 'black' | 'white';
  confidence: number;
  algorithm: string;
  wasCorrect: boolean;
  entryTiming: 'NEXT' | 'WAIT_1' | 'WAIT_2';
}

class BlazeDatabase {
  private readonly RESULTS_KEY = 'blaze_results';
  private readonly PATTERNS_KEY = 'blaze_patterns';
  private readonly STATS_KEY = 'blaze_stats';
  private readonly PREDICTIONS_KEY = 'blaze_predictions';

  // Salvar resultados
  saveResults(results: BlazeResult[]): void {
    try {
      const serializedResults = results.map(result => ({
        ...result,
        timestamp: result.timestamp.toISOString()
      }));
      localStorage.setItem(this.RESULTS_KEY, JSON.stringify(serializedResults));
    } catch (error) {
      console.error('Erro ao salvar resultados:', error);
    }
  }

  // Carregar resultados
  loadResults(): BlazeResult[] {
    try {
      const data = localStorage.getItem(this.RESULTS_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return parsed.map((result: any) => ({
        ...result,
        timestamp: new Date(result.timestamp)
      }));
    } catch (error) {
      console.error('Erro ao carregar resultados:', error);
      return [];
    }
  }

  // Adicionar novo resultado
  addResult(result: BlazeResult): void {
    const results = this.loadResults();
    results.push(result);
    
    // Manter apenas os últimos 1000 resultados
    if (results.length > 1000) {
      results.splice(0, results.length - 1000);
    }
    
    this.saveResults(results);
  }

  // Salvar padrões
  savePatterns(patterns: Pattern[]): void {
    try {
      const serializedPatterns = patterns.map(pattern => ({
        ...pattern,
        id: pattern.id || `pattern_${Date.now()}_${Math.random()}`,
        lastSeen: pattern.lastSeen.toISOString()
      }));
      localStorage.setItem(this.PATTERNS_KEY, JSON.stringify(serializedPatterns));
    } catch (error) {
      console.error('Erro ao salvar padrões:', error);
    }
  }

  // Carregar padrões
  loadPatterns(): Pattern[] {
    try {
      const data = localStorage.getItem(this.PATTERNS_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return parsed.map((pattern: any) => ({
        ...pattern,
        lastSeen: new Date(pattern.lastSeen)
      }));
    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
      return [];
    }
  }

  // Salvar estatísticas
  saveStats(stats: GameStats): void {
    try {
      const serializedStats = {
        ...stats,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STATS_KEY, JSON.stringify(serializedStats));
    } catch (error) {
      console.error('Erro ao salvar estatísticas:', error);
    }
  }

  // Carregar estatísticas
  loadStats(): GameStats | null {
    try {
      const data = localStorage.getItem(this.STATS_KEY);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated)
      };
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      return null;
    }
  }

  // Salvar histórico de predições
  savePrediction(prediction: PredictionHistory): void {
    try {
      const predictions = this.loadPredictions();
      const serializedPrediction = {
        ...prediction,
        timestamp: prediction.timestamp.toISOString()
      };
      
      predictions.push(serializedPrediction);
      
      // Manter apenas as últimas 500 predições
      if (predictions.length > 500) {
        predictions.splice(0, predictions.length - 500);
      }
      
      localStorage.setItem(this.PREDICTIONS_KEY, JSON.stringify(predictions));
    } catch (error) {
      console.error('Erro ao salvar predição:', error);
    }
  }

  // Carregar histórico de predições
  loadPredictions(): any[] {
    try {
      const data = localStorage.getItem(this.PREDICTIONS_KEY);
      if (!data) return [];
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao carregar predições:', error);
      return [];
    }
  }

  // Limpar todos os dados
  clearAllData(): void {
    try {
      localStorage.removeItem(this.RESULTS_KEY);
      localStorage.removeItem(this.PATTERNS_KEY);
      localStorage.removeItem(this.STATS_KEY);
      localStorage.removeItem(this.PREDICTIONS_KEY);
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
    }
  }

  // Exportar dados para backup
  exportData(): string {
    try {
      const data = {
        results: this.loadResults(),
        patterns: this.loadPatterns(),
        stats: this.loadStats(),
        predictions: this.loadPredictions(),
        exportDate: new Date().toISOString()
      };
      
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      return '';
    }
  }

  // Importar dados de backup
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.results) {
        this.saveResults(data.results.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        })));
      }
      
      if (data.patterns) {
        this.savePatterns(data.patterns.map((p: any) => ({
          ...p,
          lastSeen: new Date(p.lastSeen)
        })));
      }
      
      if (data.stats) {
        this.saveStats(data.stats);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      return false;
    }
  }

  // Obter estatísticas de performance
  getPerformanceStats(): {
    totalResults: number;
    totalPatterns: number;
    totalPredictions: number;
    accuracy: number;
    lastUpdate: Date | null;
  } {
    const results = this.loadResults();
    const patterns = this.loadPatterns();
    const predictions = this.loadPredictions();
    const stats = this.loadStats();
    
    return {
      totalResults: results.length,
      totalPatterns: patterns.length,
      totalPredictions: predictions.length,
      accuracy: stats?.accuracy || 0,
      lastUpdate: stats?.lastUpdated || null
    };
  }
}

// Instância singleton do banco de dados
export const blazeDB = new BlazeDatabase();

// Funções utilitárias para análise
export const analyzeColorFrequency = (results: BlazeResult[]) => {
  const counts = { red: 0, black: 0, white: 0 };
  results.forEach(result => counts[result.color]++);
  
  const total = results.length;
  return {
    red: { count: counts.red, percentage: (counts.red / total) * 100 },
    black: { count: counts.black, percentage: (counts.black / total) * 100 },
    white: { count: counts.white, percentage: (counts.white / total) * 100 }
  };
};

export const findStreaks = (results: BlazeResult[]) => {
  const streaks: { color: string; length: number; startIndex: number }[] = [];
  let currentStreak = { color: '', length: 0, startIndex: 0 };
  
  results.forEach((result, index) => {
    if (result.color === currentStreak.color) {
      currentStreak.length++;
    } else {
      if (currentStreak.length > 0) {
        streaks.push({ ...currentStreak });
      }
      currentStreak = { color: result.color, length: 1, startIndex: index };
    }
  });
  
  if (currentStreak.length > 0) {
    streaks.push(currentStreak);
  }
  
  return streaks.filter(streak => streak.length >= 3);
};

export const calculateGaps = (results: BlazeResult[], targetColor: 'red' | 'black' | 'white') => {
  const gaps: number[] = [];
  let currentGap = 0;
  
  results.forEach(result => {
    if (result.color === targetColor) {
      if (currentGap > 0) {
        gaps.push(currentGap);
      }
      currentGap = 0;
    } else {
      currentGap++;
    }
  });
  
  return {
    gaps,
    currentGap,
    averageGap: gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    maxGap: gaps.length > 0 ? Math.max(...gaps) : 0
  };
};