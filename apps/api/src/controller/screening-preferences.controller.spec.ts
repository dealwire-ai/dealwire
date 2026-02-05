import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ScreeningPreferencesController } from './screening-preferences.controller';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

describe('ScreeningPreferencesController', () => {
  let controller: ScreeningPreferencesController;
  let screeningPreferencesService: jest.Mocked<ScreeningPreferencesService>;

  beforeEach(async () => {
    const mockGetPreferences = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreeningPreferencesController],
      providers: [
        {
          provide: ScreeningPreferencesService,
          useValue: { getPreferences: mockGetPreferences },
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ScreeningPreferencesController);
    screeningPreferencesService = module.get(ScreeningPreferencesService);
  });

  describe('getScreeningPreferences', () => {
    it('should return preferences when found for organization', async () => {
      // Arrange
      const prefs = {
        companyName: 'Acme',
        dealCriteria: 'NY only',
        passedFolderName: 'Passed Deals',
      };
      screeningPreferencesService.getPreferences.mockResolvedValue(prefs);

      // Act
      const result = await controller.getScreeningPreferences('org-1');

      // Assert
      expect(screeningPreferencesService.getPreferences).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(prefs);
    });

    it('should throw FORBIDDEN when organizationId is missing', async () => {
      // Act / Assert
      await expect(controller.getScreeningPreferences(null)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        message: 'User not in organization',
      });
      expect(screeningPreferencesService.getPreferences).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when service returns empty preferences', async () => {
      // Arrange
      screeningPreferencesService.getPreferences.mockResolvedValue({});

      // Act / Assert
      await expect(controller.getScreeningPreferences('org-unknown')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Screening preferences not found for this organization',
      });
    });
  });
});
