import os
import base64
from pathlib import Path
import sys
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding

class SymmetricKeyEncryption:
    """A symmetric key encryption class using PKCS-7 padding."""

    def __init__(self, key_path):
        self.key = self.load_key(key_path)

    def load_key(self, key_path) -> bytes:
        """Load the key from file."""
        with open(Path(key_path).absolute(), "rb") as key_file:
            return key_file.read()

    def pkcs7_pad(self, message: bytes, block_size: int) -> bytes:
        padder = padding.PKCS7(block_size).padder()
        return padder.update(message) + padder.finalize()

    def pkcs7_unpad(self, padded_message: bytes, block_size: int) -> bytes:
        unpadder = padding.PKCS7(block_size).unpadder()
        return unpadder.update(padded_message) + unpadder.finalize()

    def encrypt(self, data: bytes, iv: bytes = (b'\x00' * 16)) -> bytes:
        assert len(iv) == 16
        cipher = Cipher(algorithms.AES(self.key), modes.GCM(iv))
        encryptor = cipher.encryptor()
        padded_data = self.pkcs7_pad(data, algorithms.AES.block_size * 8)
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()
        return iv + ciphertext

    def decrypt(self, encrypted_data: bytes) -> bytes:
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        cipher = Cipher(algorithms.AES(self.key), modes.GCM(iv))
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        return self.pkcs7_unpad(padded_data, algorithms.AES.block_size * 8)

    def encrypt_base64(self, plaintext: str) -> str:
        encrypted = self.encrypt(plaintext.encode("utf-8"))
        return base64.b64encode(encrypted).decode("utf-8")

    def decrypt_base64(self, b64_data: str) -> str:
        encrypted = base64.b64decode(b64_data.encode("utf-8"))
        decrypted = self.decrypt(encrypted)
        return decrypted.decode("utf-8")
    
    def batch_encrypt(self, keywords):
        keywords = json.loads(keywords)["keywords"]
        encrypted_keywords = {}
        for keyword in keywords:
            encrypted_keywords[keyword] = self.encrypt_base64(keyword)

        return encrypted_keywords
    

def main():
    if len(sys.argv) < 4:
        print("Usage: python ske.py <encrypt|batch_encrypt|decrypt> <key_path> <data>")
        sys.exit(1)

    action = sys.argv[1]
    key_path = sys.argv[2]
    data = sys.argv[3]

    ske = SymmetricKeyEncryption(key_path)

    if action == "encrypt":
        print(json.dumps({"result": ske.encrypt_base64(data)}))
    elif action == "batch_encrypt":
        print(json.dumps({"result": ske.batch_encrypt(data)}))
    elif action == "decrypt":
        print(json.dumps({"result": ske.decrypt_base64(data)}))
    else:
        print("Invalid action, use 'encrypt' or 'decrypt'")
        sys.exit(1)

if __name__ == "__main__":
    main()
