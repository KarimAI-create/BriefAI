
import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ApiKeyModal } from './components/ApiKeyModal';
import { View, BriefRequirements, ContentIdea, Campaign, ComplianceItem } from './types';
import { APP_NAME, EXAMPLE_BRIEF, API_KEY_INFO_MESSAGE } from './constants';
import { extractBriefDetails, generateContentIdeas, checkTextForTag } from './services/geminiService';
import { Home, UploadCloud, Lightbulb, CheckSquare, LayoutTemplate, BarChart2, ListChecks, Copy, AlertTriangle, CheckCircle, XCircle, Info, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  
  const [briefText, setBriefText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoComplianceResult, setVideoComplianceResult] = useState<ComplianceItem[]>([]);

  useEffect(() => {
    if (typeof process.env.API_KEY !== 'string' || process.env.API_KEY === '') {
      setApiKeyMissing(true);
    }
    // Load dark mode preference
    const isDarkModePreferred = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDarkModePreferred);
    if (isDarkModePreferred) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newState = !prev;
      if (newState) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
      }
      return newState;
    });
  };

  const handleBriefSubmit = async () => {
    if (!briefText.trim()) {
      setError("Brief text cannot be empty.");
      return;
    }
    if (apiKeyMissing) {
      setError(API_KEY_INFO_MESSAGE);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const requirements = await extractBriefDetails(briefText);
      const newCampaign: Campaign = {
        id: Date.now().toString(),
        name: requirements.campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        briefText,
        requirements,
        status: 'Brief Processed',
        createdAt: new Date().toISOString(),
        complianceChecklist: [
          { id: 'watermark', text: 'No watermark', isMet: null },
          { id: 'tag', text: `Mentions required tag (e.g., ${requirements.brandTags?.[0] || 'brand tag'})`, isMet: null },
          { id: 'duration', text: `Duration meets minimum (${requirements.minVideoLengthSeconds || 'N/A'}s)`, isMet: null },
        ]
      };
      setActiveCampaign(newCampaign);
      setCampaigns(prev => [...prev, newCampaign]);
      setCurrentView(View.CONTENT_IDEAS); // Move to content ideas after brief processing
    } catch (e: any) {
      console.error("Error processing brief:", e);
      setError(e.message || "Failed to process brief. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!activeCampaign || !activeCampaign.requirements) {
      setError("No active campaign or brief requirements to generate ideas from.");
      return;
    }
     if (apiKeyMissing) {
      setError(API_KEY_INFO_MESSAGE);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ideas = await generateContentIdeas(activeCampaign.requirements);
      setActiveCampaign(prev => prev ? { ...prev, ideas, status: 'Ideas Generated' } : null);
      setCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? { ...c, ideas, status: 'Ideas Generated' } : c));
    } catch (e: any) {
      console.error("Error generating ideas:", e);
      setError(e.message || "Failed to generate content ideas. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedVideo(file);
      setError(null);
      // Reset compliance for new video
      setVideoComplianceResult(activeCampaign?.complianceChecklist || []);
    }
  };

  const checkVideoCompliance = useCallback(async () => {
    if (!uploadedVideo || !activeCampaign || !activeCampaign.requirements) {
        setError("Please upload a video and ensure a brief is processed.");
        return;
    }
    if (apiKeyMissing && activeCampaign.requirements.brandTags?.length) { // Only block if tag check is needed
      setError(API_KEY_INFO_MESSAGE);
      return;
    }

    setIsLoading(true);
    setError(null);

    let newComplianceResult: ComplianceItem[] = JSON.parse(JSON.stringify(activeCampaign.complianceChecklist || []));

    // 1. Watermark (mock) - In a real app, this would involve complex video processing.
    const watermarkCheck = newComplianceResult.find(item => item.id === 'watermark');
    if (watermarkCheck) watermarkCheck.isMet = true; // Assume no watermark for MVP

    // 2. Duration
    const durationCheck = newComplianceResult.find(item => item.id === 'duration');
    if (durationCheck) {
        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.onloadedmetadata = async () => {
            window.URL.revokeObjectURL(videoElement.src);
            const duration = videoElement.duration;
            const minLength = activeCampaign.requirements?.minVideoLengthSeconds;
            if (minLength !== undefined) {
                durationCheck.isMet = duration >= minLength;
                durationCheck.details = `Video duration: ${duration.toFixed(1)}s. Required: ${minLength}s.`;
            } else {
                durationCheck.isMet = true; // No min length specified
                durationCheck.details = `Video duration: ${duration.toFixed(1)}s. (No minimum specified)`;
            }
             // 3. Tag detection (requires video to be loaded for duration, so do it here)
            // This is a simplified text check on video title/description if available, or a mock speech-to-text
            const tagCheck = newComplianceResult.find(item => item.id === 'tag');
            if (tagCheck && activeCampaign.requirements?.brandTags?.length) {
                // For MVP, we mock this. A real check would involve speech-to-text or OCR on video frames.
                // We'll use a mock Gemini call on filename for demonstration if API key exists.
                if(!apiKeyMissing){
                    try {
                        const tagPresent = await checkTextForTag(uploadedVideo.name, activeCampaign.requirements.brandTags[0]);
                        tagCheck.isMet = tagPresent;
                        tagCheck.details = tagPresent ? `Tag ${activeCampaign.requirements.brandTags[0]} likely present.` : `Tag ${activeCampaign.requirements.brandTags[0]} not detected in filename (mock check).`;
                    } catch (e) {
                        tagCheck.isMet = false;
                        tagCheck.details = `Error checking tag: ${(e as Error).message}`;
                    }
                } else {
                     tagCheck.isMet = false; // Cannot check without API Key
                     tagCheck.details = "API key missing, cannot perform tag check.";
                }
            } else if (tagCheck) {
                tagCheck.isMet = true; // No tags required
                tagCheck.details = "No specific tags required by brief.";
            }

            setVideoComplianceResult([...newComplianceResult]); // Trigger re-render with updated results
            setActiveCampaign(prev => prev ? { ...prev, complianceChecklist: newComplianceResult, status: 'Compliance Checked' } : null);
            setCampaigns(prev => prev.map(c => c.id === activeCampaign?.id ? { ...c, complianceChecklist: newComplianceResult, status: 'Compliance Checked' } : c));
            setIsLoading(false);
        };
        videoElement.onerror = () => {
            if (durationCheck) {
                durationCheck.isMet = false;
                durationCheck.details = "Could not load video metadata to check duration.";
            }
            setVideoComplianceResult([...newComplianceResult]);
            setIsLoading(false);
            setError("Failed to load video for duration check.");
        };
        videoElement.src = URL.createObjectURL(uploadedVideo);
    } else {
        setIsLoading(false);
    }
  }, [uploadedVideo, activeCampaign, apiKeyMissing]);


  const renderView = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <div className="text-center py-16 px-4">
            <h1 className="text-5xl font-bold mb-6 text-primary dark:text-primary-light">The Smartest Way to Submit Your Creator Campaigns.</h1>
            <p className="text-xl mb-10 text-neutral-dark dark:text-neutral-default max-w-2xl mx-auto">Get brief insights, content ideas, compliance checks, and performance tracking — all in one place.</p>
            <Button size="lg" onClick={() => setCurrentView(View.UPLOAD_BRIEF)}>
              Get Started <Home className="inline ml-2 h-5 w-5" />
            </Button>
          </div>
        );
      case View.UPLOAD_BRIEF:
        return (
          <div className="max-w-3xl mx-auto py-8 px-4">
            <h2 className="text-3xl font-semibold mb-6 flex items-center"><FileText className="mr-3 text-primary"/>Upload Campaign Brief</h2>
            <Card>
              <div className="p-6">
                <p className="mb-4 text-neutral-dark dark:text-neutral-default">Paste raw brief content into the text area below or upload a .txt file.</p>
                 <Button variant="secondary" size="sm" onClick={() => setBriefText(EXAMPLE_BRIEF)} className="mb-4">
                  Load Example Brief
                </Button>
                <textarea
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="Paste your campaign brief here..."
                  rows={15}
                  className="w-full p-3 border border-neutral-default dark:border-neutral-dark rounded-md focus:ring-2 focus:ring-primary dark:bg-neutral-darker dark:text-neutral-light focus:border-primary-dark transition-colors"
                />
                {/* Basic .txt file upload - for simplicity, it just populates the textarea */}
                <div className="mt-4">
                    <label htmlFor="txtFile" className="block text-sm font-medium text-neutral-dark dark:text-neutral-default mb-1">Or upload a .txt file:</label>
                    <input 
                        type="file" 
                        id="txtFile"
                        accept=".txt"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    setBriefText(event.target?.result as string || '');
                                };
                                reader.readAsText(file);
                            }
                        }}
                        className="w-full text-sm text-neutral-dark dark:text-neutral-light file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary-dark dark:file:bg-primary-dark dark:file:text-primary-light hover:file:bg-primary dark:hover:file:bg-primary-darker"
                    />
                </div>
                <Button onClick={handleBriefSubmit} disabled={isLoading || apiKeyMissing} className="mt-6 w-full">
                  {isLoading ? <LoadingSpinner size="sm" /> : <>Extract Key Instructions <UploadCloud className="inline ml-2 h-5 w-5" /></>}
                </Button>
                {apiKeyMissing && <p className="text-red-500 text-sm mt-2">{API_KEY_INFO_MESSAGE}</p>}
              </div>
            </Card>
          </div>
        );
      case View.CONTENT_IDEAS:
        if (!activeCampaign || !activeCampaign.requirements) {
          setCurrentView(View.UPLOAD_BRIEF); // Redirect if no active campaign
          return <p>Redirecting...</p>;
        }
        return (
          <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-3xl font-semibold flex items-center"><Lightbulb className="mr-3 text-primary"/>Content Ideas for "{activeCampaign.name}"</h2>
                <Button onClick={() => setCurrentView(View.UPLOAD_BRIEF)} variant="outline">Back to Brief</Button>
            </div>

            <Card className="mb-8">
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Extracted Requirements:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-neutral-dark dark:text-neutral-default">
                        {activeCampaign.requirements.campaignName && <li><strong>Campaign Name:</strong> {activeCampaign.requirements.campaignName}</li>}
                        {activeCampaign.requirements.brandTags && <li><strong>Tags:</strong> {activeCampaign.requirements.brandTags.join(', ')}</li>}
                        {activeCampaign.requirements.platformRules && <li><strong>Platform Rules:</strong> {activeCampaign.requirements.platformRules.join(', ')}</li>}
                        {activeCampaign.requirements.regionTargeting && <li><strong>Regions:</strong> {activeCampaign.requirements.regionTargeting.join(', ')}</li>}
                        {activeCampaign.requirements.minVideoLengthSeconds && <li><strong>Min Length:</strong> {activeCampaign.requirements.minVideoLengthSeconds}s</li>}
                        {activeCampaign.requirements.viewThreshold && <li><strong>View Threshold:</strong> {activeCampaign.requirements.viewThreshold}</li>}
                        {activeCampaign.requirements.assetLinks && <li><strong>Assets:</strong> {activeCampaign.requirements.assetLinks.map(link => <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" key={link}>{link}</a>).reduce((prev, curr) => <>{prev}, {curr}</>)}</li>}
                        {activeCampaign.requirements.otherInstructions && <li><strong>Other:</strong> {activeCampaign.requirements.otherInstructions.join(', ')}</li>}
                    </ul>
                </div>
            </Card>
            
            <Button onClick={handleGenerateIdeas} disabled={isLoading || apiKeyMissing} className="mb-8 w-full md:w-auto">
              {isLoading && !activeCampaign.ideas ? <LoadingSpinner size="sm" /> : <>Generate Content Ideas <Lightbulb className="inline ml-2 h-5 w-5" /></>}
            </Button>
            {apiKeyMissing && <p className="text-red-500 text-sm my-2">{API_KEY_INFO_MESSAGE}</p>}

            {activeCampaign.ideas && activeCampaign.ideas.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCampaign.ideas.map((idea, index) => (
                  <Card key={index} className="flex flex-col">
                    <div className="p-6 flex-grow">
                      <h4 className="text-lg font-semibold text-primary mb-2">{idea.title}</h4>
                      <p className="text-sm mb-1"><strong className="font-medium">Hook (3s):</strong> {idea.hook}</p>
                      <p className="text-sm mb-1"><strong className="font-medium">Caption:</strong> {idea.caption}</p>
                      <p className="text-sm"><strong className="font-medium">Tone:</strong> {idea.tone}</p>
                    </div>
                    <div className="p-4 border-t border-neutral-default dark:border-neutral-dark mt-auto">
                        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(`Title: ${idea.title}\nHook: ${idea.hook}\nCaption: ${idea.caption}\nTone: ${idea.tone}`)}>
                            <Copy className="h-4 w-4 mr-2" /> Copy Idea
                        </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {isLoading && activeCampaign.ideas && <div className="mt-4 text-center"><LoadingSpinner /> <p>Loading more ideas...</p></div>}
          </div>
        );
       case View.COMPLIANCE_CHECKER:
        return (
          <div className="max-w-2xl mx-auto py-8 px-4">
            <h2 className="text-3xl font-semibold mb-6 flex items-center"><CheckSquare className="mr-3 text-primary"/>Compliance Checker</h2>
            {!activeCampaign && <p className="text-center text-neutral-dark dark:text-neutral-default p-4 border border-dashed border-neutral-default dark:border-neutral-dark rounded-md">Please <Button variant="link" onClick={() => setCurrentView(View.UPLOAD_BRIEF)}>upload and process a brief</Button> first to enable compliance checks for a campaign.</p>}
            {activeCampaign && (
                <>
                <p className="mb-4 text-neutral-dark dark:text-neutral-default">Upload your video (MP4) to check against the brief requirements for "{activeCampaign.name}".</p>
                <Card className="mb-6">
                    <div className="p-6">
                        <input type="file" accept="video/mp4" onChange={handleVideoUpload} className="w-full text-sm text-neutral-dark dark:text-neutral-light file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary-dark dark:file:bg-primary-dark dark:file:text-primary-light hover:file:bg-primary dark:hover:file:bg-primary-darker mb-4" />
                        {uploadedVideo && <p className="text-sm text-green-600 dark:text-green-400">Selected: {uploadedVideo.name}</p>}
                        <Button onClick={checkVideoCompliance} disabled={!uploadedVideo || isLoading} className="w-full mt-2">
                            {isLoading ? <LoadingSpinner size="sm" /> : 'Check Compliance'}
                        </Button>
                        {apiKeyMissing && activeCampaign.requirements?.brandTags?.length && <p className="text-red-500 text-sm mt-2">{API_KEY_INFO_MESSAGE} (Tag check disabled)</p>}
                    </div>
                </Card>
                
                {videoComplianceResult.length > 0 && (
                <Card>
                    <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">Compliance Results:</h3>
                    <ul className="space-y-3">
                        {videoComplianceResult.map(item => (
                        <li key={item.id} className="flex items-start p-3 rounded-md bg-neutral-light dark:bg-neutral-darker border border-neutral-default dark:border-neutral-dark">
                            {item.isMet === true && <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />}
                            {item.isMet === false && <XCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />}
                            {item.isMet === null && <Info className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />}
                            <div>
                                <span className={`font-medium ${item.isMet === true ? 'text-green-700 dark:text-green-400' : item.isMet === false ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>{item.text}</span>
                                {item.details && <p className="text-xs text-neutral-dark dark:text-neutral-default mt-0.5">{item.details}</p>}
                            </div>
                        </li>
                        ))}
                    </ul>
                    </div>
                </Card>
                )}
                </>
            )}
          </div>
        );
      case View.LANDING_PAGE_GENERATOR:
        return (
          <div className="max-w-2xl mx-auto py-8 px-4">
            <h2 className="text-3xl font-semibold mb-6 flex items-center"><LayoutTemplate className="mr-3 text-primary"/>Landing Page Generator</h2>
            <Card>
              <div className="p-6 text-center">
                <LayoutTemplate className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
                <p className="text-neutral-dark dark:text-neutral-default">This feature will help you quickly create a simple, branded landing page for your campaign links.</p>
                <p className="text-sm text-neutral-default dark:text-neutral-dark mt-2">(Coming Soon)</p>
                <Button disabled className="mt-6">Design Your Landing Page</Button>
              </div>
            </Card>
          </div>
        );
      case View.PERFORMANCE_TRACKER:
        return (
          <div className="max-w-2xl mx-auto py-8 px-4">
            <h2 className="text-3xl font-semibold mb-6 flex items-center"><BarChart2 className="mr-3 text-primary"/>Performance Tracker</h2>
            <Card>
              <div className="p-6 text-center">
                <BarChart2 className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
                <p className="text-neutral-dark dark:text-neutral-default">Track the performance of your submitted content. Paste your video link to monitor views and engagement.</p>
                <p className="text-sm text-neutral-default dark:text-neutral-dark mt-2">(Coming Soon - MVP will show basic input)</p>
                <input type="text" placeholder="Paste video URL (e.g., TikTok, Instagram)" className="w-full p-3 border border-neutral-default dark:border-neutral-dark rounded-md focus:ring-2 focus:ring-primary dark:bg-neutral-darker dark:text-neutral-light focus:border-primary-dark transition-colors mt-4" disabled/>
                <Button disabled className="mt-4">Track Performance</Button>
              </div>
            </Card>
          </div>
        );
      case View.DASHBOARD:
        return (
          <div className="max-w-4xl mx-auto py-8 px-4">
            <h2 className="text-3xl font-semibold mb-6 flex items-center"><ListChecks className="mr-3 text-primary"/>Campaign Dashboard</h2>
            {campaigns.length === 0 ? (
              <Card>
                <div className="p-6 text-center">
                  <p className="text-neutral-dark dark:text-neutral-default">No campaigns yet. <Button variant="link" onClick={() => setCurrentView(View.UPLOAD_BRIEF)}>Upload your first brief</Button> to get started.</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {campaigns.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(campaign => (
                  <Card key={campaign.id}>
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-primary mb-1">{campaign.name}</h3>
                          <p className="text-xs text-neutral-default dark:text-neutral-dark mb-3">Created: {new Date(campaign.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            campaign.status === 'Brief Processed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                            campaign.status === 'Ideas Generated' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                            campaign.status === 'Compliance Checked' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>{campaign.status}</span>
                      </div>
                      <p className="text-sm text-neutral-dark dark:text-neutral-default mb-3 truncate">{campaign.briefText.substring(0,150)}...</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setActiveCampaign(campaign); setCurrentView(View.CONTENT_IDEAS); }}>View Details/Ideas</Button>
                        <Button size="sm" variant="outline" onClick={() => { setActiveCampaign(campaign); setUploadedVideo(null); setVideoComplianceResult(campaign.complianceChecklist || []); setCurrentView(View.COMPLIANCE_CHECKER); }}>Check Compliance</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return <p>Page not found.</p>;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="my-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-3" />
              <span>{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800">
                <XCircle className="h-5 w-5"/>
            </Button>
          </div>
        )}
        {isLoading && currentView !== View.UPLOAD_BRIEF && currentView !== View.CONTENT_IDEAS && currentView !== View.COMPLIANCE_CHECKER && <div className="fixed inset-0 bg-neutral-darkest bg-opacity-50 flex items-center justify-center z-50"><LoadingSpinner /></div>}
        {renderView()}
      </main>
      <Footer />
      {apiKeyMissing && <ApiKeyModal />}
    </div>
  );
};

export default App;
