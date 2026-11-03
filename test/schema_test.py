import unittest
from pathlib import Path
import yaml

class NangoSchemaTest(unittest.TestCase):
    def test_query_model_declares_additive_fields(self):
        spec = yaml.safe_load((Path(__file__).parents[1] / 'nango.yaml').read_text())
        models = spec['models']
        self.assertEqual(models['QueryInput']['includeTableSql'], 'boolean | undefined')
        self.assertEqual(models['QueryInput']['tableLimit'], 'number | undefined')
        for key in ('chunk_metadata', 'tabular_data', 'temporal_facts', 'temporal_duration', 'temporal_filter', 'warnings'):
            self.assertIn(key + '?', models['Chunk'])
        self.assertEqual(spec['integrations']['hydradb']['actions']['recall-context']['output'], 'Chunk[]')

if __name__ == '__main__': unittest.main()
