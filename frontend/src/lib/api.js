import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const fileUrl = (path) => `${API}/files/${path}`;

export async function analyzeImage(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(`${API}/analyze`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function generatePrompt(projectId, payload) {
  const { data } = await axios.post(`${API}/projects/${projectId}/generate`, payload);
  return data;
}
