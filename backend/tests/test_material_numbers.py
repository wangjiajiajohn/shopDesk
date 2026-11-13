import unittest
from types import SimpleNamespace
from app.routers.reference_products import assign_material_numbers

def item(number=None):
 return SimpleNamespace(index_data={'title':'keep','materialNumber':number},detail_data={'images':[{'asset':'original'}]})
class MaterialNumberTests(unittest.TestCase):
 def test_existing_numbers_stay_fixed_and_new_numbers_append(self):
  a,b,c=item(5),item(),item(2)
  self.assertTrue(assign_material_numbers([a,b,c]));self.assertEqual(b.index_data['materialNumber'],6)
  self.assertFalse(assign_material_numbers([c,b,a]));self.assertEqual(a.index_data['materialNumber'],5)
  self.assertEqual(b.detail_data['images'],[{'asset':'original'}])
 def test_duplicates_and_invalid_values_get_distinct_numbers(self):
  products=[item(1),item(1),item(True),item(0)]
  assign_material_numbers(products);self.assertEqual([p.index_data['materialNumber'] for p in products],[1,2,3,4])
 def test_index_and_detail_are_consistent(self):
  p=item(12);assign_material_numbers([p]);self.assertEqual(p.detail_data['materialNumber'],12)
if __name__=='__main__':unittest.main()
