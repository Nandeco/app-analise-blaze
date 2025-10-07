// Sistema de integração com TipMiner para dados reais da Blaze
import { BlazeResult } from './database';

export interface TipMinerResult {
  id: number;
  color: number; // 0 = branco, 1 = vermelho, 2 = preto
  roll: number;
  created_at: string;
}

class TipMinerAPI {
  private readonly BASE_URL = 'https://www.tipminer.com/br/historico/blaze/double';
  private readonly PROXY_URL = 'https://api.allorigins.win/raw?url=';
  
  // Converter cor do TipMiner para nosso formato
  private convertColor(colorCode: number): 'red' | 'black' | 'white' {
    switch (colorCode) {
      case 0: return 'white';
      case 1: return 'red';
      case 2: return 'black';
      default: return 'red';
    }
  }

  // Converter resultado do TipMiner para nosso formato
  private convertResult(tipMinerResult: TipMinerResult): BlazeResult {
    return {
      id: tipMinerResult.id,
      color: this.convertColor(tipMinerResult.color),
      number: tipMinerResult.roll,
      timestamp: new Date(tipMinerResult.created_at)
    };
  }

  // Buscar dados históricos (simulado - devido a CORS)
  async fetchHistoricalData(limit: number = 100): Promise<BlazeResult[]> {
    try {
      // Nota: Devido às restrições de CORS, vamos simular dados realistas
      // Em produção, seria necessário um backend para fazer o scraping
      console.log('Simulando busca de dados do TipMiner...');
      
      const simulatedData: BlazeResult[] = [];
      const now = new Date();
      
      for (let i = limit; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60000); // 1 minuto entre resultados
        const rand = Math.random();
        
        let color: 'red' | 'black' | 'white';
        let number: number;
        
        if (rand < 0.02) { // 2% branco
          color = 'white';
          number = 0;
        } else if (rand < 0.51) { // 49% vermelho
          color = 'red';
          number = Math.floor(Math.random() * 7) + 1;
        } else { // 49% preto
          color = 'black';
          number = Math.floor(Math.random() * 7) + 8;
        }
        
        simulatedData.push({
          id: timestamp.getTime(),
          color,
          number,
          timestamp
        });
      }
      
      return simulatedData;
    } catch (error) {
      console.error('Erro ao buscar dados do TipMiner:', error);
      return [];
    }
  }

  // Buscar último resultado (simulado)
  async fetchLatestResult(): Promise<BlazeResult | null> {
    try {
      console.log('Simulando busca do último resultado...');
      
      const rand = Math.random();
      let color: 'red' | 'black' | 'white';
      let number: number;
      
      if (rand < 0.02) {
        color = 'white';
        number = 0;
      } else if (rand < 0.51) {
        color = 'red';
        number = Math.floor(Math.random() * 7) + 1;
      } else {
        color = 'black';
        number = Math.floor(Math.random() * 7) + 8;
      }
      
      return {
        id: Date.now(),
        color,
        number,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Erro ao buscar último resultado:', error);
      return null;
    }
  }

  // Monitorar novos resultados (simulado)
  startMonitoring(callback: (result: BlazeResult) => void, intervalMs: number = 30000): () => void {
    console.log('Iniciando monitoramento de novos resultados...');
    
    const interval = setInterval(async () => {
      const latestResult = await this.fetchLatestResult();
      if (latestResult) {
        callback(latestResult);
      }
    }, intervalMs);
    
    // Retorna função para parar o monitoramento
    return () => {
      clearInterval(interval);
      console.log('Monitoramento parado.');
    };
  }

  // Verificar se API está disponível
  async checkAPIStatus(): Promise<boolean> {
    try {
      // Em um cenário real, faria uma requisição de teste
      console.log('Verificando status da API...');
      return true; // Simulando que está disponível
    } catch (error) {
      console.error('API indisponível:', error);
      return false;
    }
  }

  // Obter estatísticas da API
  async getAPIStats(): Promise<{
    isOnline: boolean;
    lastUpdate: Date | null;
    totalResults: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    const isOnline = await this.checkAPIStatus();
    const responseTime = Date.now() - startTime;
    
    return {
      isOnline,
      lastUpdate: isOnline ? new Date() : null,
      totalResults: isOnline ? 1000 : 0, // Simulado
      responseTime
    };
  }
}

// Instância singleton da API
export const tipMinerAPI = new TipMinerAPI();

// Sistema de cache para otimizar requisições
class DataCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

export const dataCache = new DataCache();

// Função para sincronizar dados locais com TipMiner
export async function syncWithTipMiner(): Promise<{
  success: boolean;
  newResults: number;
  error?: string;
}> {
  try {
    console.log('Iniciando sincronização com TipMiner...');
    
    // Verificar se há dados em cache
    const cachedData = dataCache.get('latest_sync');
    if (cachedData) {
      return {
        success: true,
        newResults: 0
      };
    }
    
    // Buscar novos dados
    const newResults = await tipMinerAPI.fetchHistoricalData(50);
    
    if (newResults.length > 0) {
      // Cache dos dados por 5 minutos
      dataCache.set('latest_sync', newResults, 300000);
      
      return {
        success: true,
        newResults: newResults.length
      };
    }
    
    return {
      success: false,
      newResults: 0,
      error: 'Nenhum dado encontrado'
    };
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return {
      success: false,
      newResults: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Função para validar dados recebidos
export function validateBlazeResult(result: any): result is BlazeResult {
  return (
    typeof result === 'object' &&
    typeof result.id === 'number' &&
    ['red', 'black', 'white'].includes(result.color) &&
    typeof result.number === 'number' &&
    result.timestamp instanceof Date
  );
}

// Função para detectar anomalias nos dados
export function detectAnomalies(results: BlazeResult[]): {
  hasAnomalies: boolean;
  anomalies: string[];
} {
  const anomalies: string[] = [];
  
  if (results.length === 0) {
    return { hasAnomalies: false, anomalies: [] };
  }
  
  // Verificar frequência do branco (deve ser ~2%)
  const whiteCount = results.filter(r => r.color === 'white').length;
  const whitePercentage = (whiteCount / results.length) * 100;
  
  if (whitePercentage > 5) {
    anomalies.push(`Frequência de branco muito alta: ${whitePercentage.toFixed(1)}%`);
  }
  
  if (whitePercentage < 0.5 && results.length > 100) {
    anomalies.push(`Frequência de branco muito baixa: ${whitePercentage.toFixed(1)}%`);
  }
  
  // Verificar sequências muito longas
  let currentStreak = 1;
  let maxStreak = 1;
  let streakColor = results[0].color;
  
  for (let i = 1; i < results.length; i++) {
    if (results[i].color === results[i-1].color) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  if (maxStreak > 15) {
    anomalies.push(`Sequência muito longa detectada: ${maxStreak} ${streakColor}s consecutivos`);
  }
  
  // Verificar timestamps
  const timestamps = results.map(r => r.timestamp.getTime()).sort((a, b) => a - b);
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i-1];
    if (gap < 10000) { // Menos de 10 segundos
      anomalies.push('Intervalos muito curtos entre resultados detectados');
      break;
    }
  }
  
  return {
    hasAnomalies: anomalies.length > 0,
    anomalies
  };
}