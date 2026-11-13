"""Offline contract tests. Never contacts the API or reads/logs credentials."""
import unittest
from unittest.mock import patch
import httpx
from app.services.ai.client import AIClient

class ResponsesTests(unittest.IsolatedAsyncioTestCase):
 async def test_text_images_usage_and_no_storage(self):
  seen=[]
  def handler(request):
   import json
   seen.append((str(request.url),json.loads(request.content)))
   return httpx.Response(200,json={'status':'completed','id':'test','model':'test-model','output':[{'type':'message','content':[{'type':'output_text','text':'uno'},{'type':'output_text','text':'dos'}]}],'usage':{'total_tokens':3}})
  client=AIClient();client._client=httpx.AsyncClient(base_url='https://api.openai.com/v1/',transport=httpx.MockTransport(handler))
  try:
   result=await client.respond('Analyze',['https://example.com/product.jpg'],model='test-model',max_output_tokens=100)
   self.assertEqual(result['content'],'uno\ndos');self.assertEqual(result['usage']['total_tokens'],3)
   self.assertEqual(seen[0][0],'https://api.openai.com/v1/responses')
   self.assertFalse(seen[0][1]['store']);self.assertEqual(seen[0][1]['input'][0]['content'][1]['type'],'input_image')
  finally:await client.aclose()
 async def test_incomplete_is_not_success(self):
  c=AIClient();c._client=httpx.AsyncClient(base_url='https://api.openai.com/v1/',transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'status':'incomplete','output':[]})))
  try:
   with self.assertRaises(RuntimeError):await c.respond('Test')
  finally:await c.aclose()
 async def test_http_failure_propagates(self):
  c=AIClient();c._client=httpx.AsyncClient(base_url='https://api.openai.com/v1/',transport=httpx.MockTransport(lambda r:httpx.Response(429,json={'error':{'code':'credit_balance_exhausted'}})))
  try:
   with self.assertRaises(httpx.HTTPStatusError):await c.respond('Test')
  finally:await c.aclose()

if __name__=='__main__':unittest.main()
