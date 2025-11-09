import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 5000,
});



export const getLeaderboard = async () => {
  try {
   
    const response = await apiClient.get('/leaderboard');
    return response.data;
  } catch (error) {
    console.error('Lỗi khi tải Bảng xếp hạng:', error);
    throw error;
  }
};


export const getMatchDetails = async (matchId) => {
  try {
    const response = await apiClient.get(`/matches/${matchId}`);
    return response.data;
  } catch (error) {
    console.error(`Lỗi khi tải chi tiết trận ${matchId}:`, error);
    throw error;
  }
};