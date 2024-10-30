import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DreamCaptureStudio from './dream-capture-studio';

describe('DreamCaptureStudio', () => {
    beforeAll(() => {
        // Mock MediaDevices API
        global.MediaStream = jest.fn().mockImplementation(() => ({
            getTracks: () => [{
                stop: jest.fn()
            }]
        }));

        Object.defineProperty(global.navigator, 'mediaDevices', {
            value: {
                getUserMedia: jest.fn().mockResolvedValue(new MediaStream())
            },
            configurable: true
        });
    });

    test('renders main components', () => {
        render(<DreamCaptureStudio />);
        
        // Check for main elements
        expect(screen.getByText('dream capture studio')).toBeInTheDocument();
        expect(screen.getByText('Auto record dreams')).toBeInTheDocument();
    });
}); 