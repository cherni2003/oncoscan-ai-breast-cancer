import torch
import torch.nn as nn
import numpy as np

class RiskModel(nn.Module):
    def __init__(self, input_size):
        super(RiskModel, self).__init__()
        self.fc1 = nn.Linear(input_size, 16)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(16, 8)
        self.fc3 = nn.Linear(8, 1)
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        out = self.relu(out)
        out = self.fc3(out)
        out = self.sigmoid(out)
        return out

def preprocess_patient(patient_data):
    # Encodage simple pour l'exemple
    # age, history_count, gender_code
    age = patient_data.get("age", 50) / 100.0
    history_count = len(patient_data.get("history", [])) / 5.0
    gender_code = 1.0 if patient_data.get("gender") == "Female" else 0.0
    
    return torch.tensor([age, history_count, gender_code], dtype=torch.float32)

def predict_risk(patient_data):
    input_size = 3
    model = RiskModel(input_size)
    # Dans un cas réel, on chargerait des poids entraînés
    # model.load_state_dict(torch.load('data/risk_model.pth'))
    model.eval()
    
    with torch.no_grad():
        input_tensor = preprocess_patient(patient_data)
        prediction = model(input_tensor)
        return prediction.item()

if __name__ == "__main__":
    # Test simple
    example_patient = {"age": 62, "gender": "Female", "history": ["Family history", "Smoking"]}
    risk = predict_risk(example_patient)
    print(f"Predicted Risk: {risk:.4f}")
