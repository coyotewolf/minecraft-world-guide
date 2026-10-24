import base64,io,json,unittest,zipfile
from scan_secrets import Scanner
class SecretScannerTests(unittest.TestCase):
 def test_nested_download_secret_is_detected_without_printing_value(self):
  secret=b'AIza'+b'A'*35;inner=io.BytesIO()
  with zipfile.ZipFile(inner,'w') as z:z.writestr('Example.class',secret)
  outer=io.BytesIO()
  with zipfile.ZipFile(outer,'w') as z:z.writestr('nested.jar',inner.getvalue())
  s=Scanner();s.scan(outer.getvalue(),'download.jar');self.assertGreaterEqual(len(s.findings),1);self.assertNotIn(secret.decode(),json.dumps(s.findings));self.assertIn('nested.jar!Example.class',s.findings[-1]['path'])
 def test_publishable_and_anon_keys_are_public_but_session_tokens_are_not(self):
  def token(role):
   enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).rstrip(b'=')
   return enc({'alg':'HS256'})+b'.'+enc({'role':role,'sub':'fixture'})+b'.'+b'A'*32
  s=Scanner();s.scan(b'sb_publishable_fixture-public-key '+token('anon'),'public-config');self.assertFalse(s.findings)
  s.scan(token('authenticated'),'session');self.assertEqual(s.findings[0]['type'],'jwt')
 def test_opaque_assignment_is_detected(self):
  s=Scanner();s.scan(b'GEMINI_API_KEY="'+b'z'*40+b'"','config');self.assertEqual(s.findings[0]['type'],'assigned_credential')
if __name__=='__main__':unittest.main()
