import { BaseEntity } from './base.entity';

class TestEntity extends BaseEntity {
  name: string;
}

describe('BaseEntity', () => {
  it('should expose _id matching id and serialize properly in toJSON', () => {
    const entity = new TestEntity();
    entity.id = 'a8098c1a-f86e-11da-bd1a-00112444be1e';
    entity.name = 'Test Project';
    entity.createdAt = new Date('2026-01-01T00:00:00Z');
    entity.updatedAt = new Date('2026-01-01T00:00:00Z');

    expect(entity._id).toBe(entity.id);

    const json = entity.toJSON();
    expect(json._id).toBe(entity.id);
    expect(json.name).toBe('Test Project');
  });
});
