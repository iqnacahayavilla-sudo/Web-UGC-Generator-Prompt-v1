import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const fileUrl = (path) => `${API}/files/${path}`;

export async function analyzeImage(file) {
  const toBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  try {
    const base64Data = await toBase64(file);
    const { data } = await axios.post(
      `${API}/analyze`,
      { image_base64: base64Data, filename: file.name },
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (jsonErr) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await axios.post(`${API}/analyze`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
}


export async function generatePrompt(projectId, payload) {
  const { data } = await axios.post(`${API}/projects/${projectId}/generate`, payload);
  return data;
}

export async function adminCreateUser(payload) {
  const { data } = await axios.post(`${API}/admin/users/create`, payload, {
    headers: { "Content-Type": "application/json" }
  });
  return data;
}

export async function adminGetUsers(adminEmail) {
  const { data } = await axios.get(`${API}/admin/users`, {
    params: { admin_email: adminEmail }
  });
  return data;
}

export async function adminAdjustCredits(payload) {
  const { data } = await axios.post(`${API}/admin/users/adjust-credits`, payload, {
    headers: { "Content-Type": "application/json" }
  });
  return data;
}

export async function getUserProjects(userId) {
  try {
    const { data } = await axios.get(`${API}/projects`, {
      params: { user_id: userId }
    });
    return data;
  } catch (e) {
    return { success: false, projects: [] };
  }
}

