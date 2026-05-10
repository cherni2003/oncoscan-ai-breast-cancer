import json
import os
import nltk
import numpy as np
import pickle
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from nltk.stem import PorterStemmer

nltk.download('punkt',     quiet=True)
nltk.download('punkt_tab', quiet=True)

stemmer = PorterStemmer()

# ── Chemins relatifs au script ────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BASE_DIR, "data")
INTENTS_FILE = os.path.join(DATA_DIR, "intents.json")
MODEL_FILE   = os.path.join(DATA_DIR, "model.pth")
WORDS_FILE   = os.path.join(DATA_DIR, "words.pkl")
CLASSES_FILE = os.path.join(DATA_DIR, "classes.pkl")

os.makedirs(DATA_DIR, exist_ok=True)

# ── Fonctions NLP ─────────────────────────────────────────────────────────────

def tokenize(sentence):
    return nltk.word_tokenize(sentence)

def stem(word):
    return stemmer.stem(word.lower())

def bag_of_words(tokenized_sentence, words):
    sentence_words = [stem(word) for word in tokenized_sentence]
    bag = np.zeros(len(words), dtype=np.float32)
    for idx, w in enumerate(words):
        if w in sentence_words:
            bag[idx] = 1
    return bag

# ── Modèle ────────────────────────────────────────────────────────────────────

class NeuralNet(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(NeuralNet, self).__init__()
        self.l1   = nn.Linear(input_size, hidden_size)
        self.l2   = nn.Linear(hidden_size, hidden_size)
        self.l3   = nn.Linear(hidden_size, num_classes)
        self.relu = nn.ReLU()

    def forward(self, x):
        out = self.l1(x);   out = self.relu(out)
        out = self.l2(out); out = self.relu(out)
        out = self.l3(out)
        return out

# ── Entraînement ──────────────────────────────────────────────────────────────

def train():
    with open(INTENTS_FILE, 'r', encoding='utf-8') as f:
        intents = json.load(f)

    all_words, tags, xy = [], [], []

    for intent in intents['intents']:
        tag = intent['tag']
        tags.append(tag)
        for pattern in intent['patterns']:
            w = tokenize(pattern)
            all_words.extend(w)
            xy.append((w, tag))

    ignore    = ['?', '!', '.', ',']
    all_words = sorted(set(stem(w) for w in all_words if w not in ignore))
    tags      = sorted(set(tags))

    X_train, y_train = [], []
    for pattern_sentence, tag in xy:
        X_train.append(bag_of_words(pattern_sentence, all_words))
        y_train.append(tags.index(tag))

    X_train = np.array(X_train)
    y_train = np.array(y_train)

    input_size    = len(all_words)
    hidden_size   = 8
    output_size   = len(tags)
    learning_rate = 0.001
    num_epochs    = 1000

    class ChatDataset(Dataset):
        def __getitem__(self, i): return X_train[i], y_train[i]
        def __len__(self):        return len(X_train)

    loader = DataLoader(ChatDataset(), batch_size=8, shuffle=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model  = NeuralNet(input_size, hidden_size, output_size).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    for epoch in range(num_epochs):
        for words_batch, labels in loader:
            words_batch = words_batch.to(device)
            labels      = labels.to(dtype=torch.long).to(device)
            outputs     = model(words_batch)
            loss        = criterion(outputs, labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        if (epoch + 1) % 100 == 0:
            print(f'Epoch [{epoch+1}/{num_epochs}]  Loss: {loss.item():.4f}')

    torch.save({
        "model_state": model.state_dict(),
        "input_size":  input_size,
        "hidden_size": hidden_size,
        "output_size": output_size,
        "all_words":   all_words,
        "tags":        tags,
    }, MODEL_FILE)

    with open(WORDS_FILE,   'wb') as f: pickle.dump(all_words, f)
    with open(CLASSES_FILE, 'wb') as f: pickle.dump(tags, f)

    print(f'\n✅ Modèle sauvegardé → {MODEL_FILE}')
    print(f'   Tags : {tags}')
    print(f'   Vocabulaire : {len(all_words)} mots')

if __name__ == "__main__":
    train()