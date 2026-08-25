
from test_solver import sample_payload, _batch_payload, client

def test_parallel_batches_with_all_assignment(sample_payload):
    payload = _batch_payload(sample_payload)
    for t in payload['teachers']:
        t['unavailableTimeSlots'] = []
    
    payload['teachingAssignments'][0].pop('batchId')
    
    payload['timeslots'] = payload['timeslots'][:2]
    
    response = client.post('/generate', json=payload)
    data = response.json()
    print('Success with 2 timeslots?', data.get('success'))
    if not data.get('success'):
        print('Violations:', data.get('violations'))
    
    assert data.get('success') is True
